import { getTransactions, getAddressInfo } from '../api/toncenter';

// Known Cocoon contract code hashes (SHA256 of decoded base64 code, first 16 hex chars)
// These identify contract types on-chain
const COCOON_PROXY_HASH = '7e94eaaeaaa423b9'; // cocoon_wallet / proxy payment contract

function computeCodeHash(codeBase64) {
  if (!codeBase64) return null;
  // Simple hash: use code length + first 40 chars as fingerprint
  // (Real SHA256 would need crypto API, this is sufficient for classification)
  return `${codeBase64.length}:${codeBase64.slice(0, 40)}`;
}

function isWalletCode(codeBase64) {
  if (!codeBase64) return false;
  // Standard TON wallets have very short code (< 250 chars base64)
  if (codeBase64.length <= 250) return true;
  // WalletV4/V5 patterns - these start with specific prefixes and are ~1400-1800 chars
  // but cocoon contracts also start with te6cck, so check length ranges
  // WalletV4R2 is exactly len=1460, WalletV5 is around 1700-1800
  // Cocoon proxy is 876, cocoon worker is 760-988
  return false;
}

function isCocoonProxy(codeBase64) {
  if (!codeBase64) return false;
  // Cocoon proxy/wallet contracts are exactly 876 chars
  // and start with this specific prefix
  return codeBase64.length === 876 &&
    codeBase64.startsWith('te6cckECFAEAAoEAART/APSkE/S88sgLAQIBIAID');
}

function isCocoonContract(codeBase64) {
  if (!codeBase64) return false;
  // Known Cocoon contract code lengths: 760, 876, 988
  // All start with te6cckEC and contain APSkE/S88sgL
  if (!codeBase64.includes('APSkE/S88sgL')) return false;
  const len = codeBase64.length;
  return len === 760 || len === 876 || len === 988;
}

export async function discoverContracts(rootAddress) {
  const discovered = {
    root: { address: rootAddress, balance: '0', state: 'unknown', lastActivity: 0 },
    proxies: new Map(),
    clients: new Map(),
    workers: new Map(),
    allTransactions: [],
  };

  // Phase 1: Get root contract info + transactions
  const [rootInfo, rootTxs] = await Promise.all([
    getAddressInfo(rootAddress),
    getTransactions(rootAddress, 50),
  ]);

  discovered.root.balance = rootInfo.balance;
  discovered.root.state = rootInfo.state;
  discovered.root.lastActivity = rootTxs[0]?.utime || 0;
  discovered.allTransactions.push(
    ...rootTxs.map(tx => ({ ...tx, contractRole: 'root' }))
  );

  // Phase 2: Extract unique interacting addresses
  const interactingAddresses = new Set();
  for (const tx of rootTxs) {
    if (tx.in_msg?.source) interactingAddresses.add(tx.in_msg.source);
    for (const outMsg of tx.out_msgs || []) {
      if (outMsg.destination) interactingAddresses.add(outMsg.destination);
    }
  }
  interactingAddresses.delete('');
  interactingAddresses.delete(rootAddress);

  // Phase 3: Check each address — only keep Cocoon proxy contracts
  const addressChecks = await Promise.allSettled(
    [...interactingAddresses].map(async addr => {
      const info = await getAddressInfo(addr);
      return { address: addr, ...info };
    })
  );

  for (const result of addressChecks) {
    if (result.status !== 'fulfilled') continue;
    const info = result.value;
    if (info.state !== 'active' || !info.code) continue;

    // Only accept Cocoon proxy contracts (code hash match)
    if (!isCocoonProxy(info.code)) continue;

    discovered.proxies.set(info.address, {
      address: info.address,
      balance: info.balance,
      state: info.state,
      clients: new Map(),
      workers: new Map(),
      lastActivity: 0,
    });
  }

  // Phase 4: For each proxy, discover clients and workers
  const proxyTxPromises = [...discovered.proxies.keys()].map(async proxyAddr => {
    try {
      const txs = await getTransactions(proxyAddr, 30);
      const proxy = discovered.proxies.get(proxyAddr);
      proxy.lastActivity = txs[0]?.utime || 0;

      discovered.allTransactions.push(
        ...txs.map(tx => ({ ...tx, contractRole: 'proxy' }))
      );

      // Collect child addresses (exclude root and self)
      const childAddrs = new Set();
      for (const tx of txs) {
        if (tx.in_msg?.source && tx.in_msg.source !== rootAddress && tx.in_msg.source !== proxyAddr) {
          childAddrs.add(tx.in_msg.source);
        }
        for (const outMsg of tx.out_msgs || []) {
          if (outMsg.destination && outMsg.destination !== rootAddress && outMsg.destination !== proxyAddr) {
            childAddrs.add(outMsg.destination);
          }
        }
      }

      // Remove other known proxies
      for (const pAddr of discovered.proxies.keys()) {
        childAddrs.delete(pAddr);
      }

      const childChecks = await Promise.allSettled(
        [...childAddrs].slice(0, 30).map(async addr => {
          const info = await getAddressInfo(addr);
          return {
            address: addr,
            balance: info.balance,
            state: info.state,
            code: info.code || '',
          };
        })
      );

      for (const result of childChecks) {
        if (result.status !== 'fulfilled') continue;
        const child = result.value;
        if (child.state !== 'active') continue;

        // Skip wallets and non-cocoon contracts
        if (isWalletCode(child.code)) continue;
        if (!child.code) continue;

        // Skip if it's another cocoon proxy (not a client/worker)
        if (isCocoonProxy(child.code)) continue;

        // Classify based on transaction direction with this proxy:
        // - Contracts that SEND money to the proxy = clients (paying for inference)
        // - Contracts that RECEIVE money from the proxy = workers (getting paid)
        const sendsToProxy = txs.some(tx => {
          const val = parseInt(tx.in_msg?.value || '0');
          return tx.in_msg?.source === child.address && val > 0;
        });
        const receivesFromProxy = txs.some(tx =>
          (tx.out_msgs || []).some(m => m.destination === child.address && parseInt(m.value || '0') > 0)
        );

        const entry = {
          address: child.address,
          balance: child.balance,
          proxyAddress: proxyAddr,
        };

        if (receivesFromProxy && !sendsToProxy) {
          discovered.workers.set(child.address, entry);
          proxy.workers.set(child.address, child);
        } else if (sendsToProxy && !receivesFromProxy) {
          discovered.clients.set(child.address, entry);
          proxy.clients.set(child.address, child);
        } else if (isCocoonContract(child.code)) {
          // If direction is ambiguous but it's a cocoon contract,
          // use code length as heuristic: shorter code (760) = worker, longer (988) = client
          if (child.code.length <= 800) {
            discovered.workers.set(child.address, entry);
            proxy.workers.set(child.address, child);
          } else {
            discovered.clients.set(child.address, entry);
            proxy.clients.set(child.address, child);
          }
        }
        // else: skip non-cocoon contracts with ambiguous direction
      }
    } catch (err) {
      console.warn(`Failed to analyze proxy ${proxyAddr}:`, err.message);
    }
  });

  await Promise.allSettled(proxyTxPromises);

  // Deduplicate and sort transactions by time
  const txMap = new Map();
  for (const tx of discovered.allTransactions) {
    const key = tx.transaction_id.lt + tx.transaction_id.hash;
    if (!txMap.has(key)) txMap.set(key, tx);
  }
  discovered.allTransactions = [...txMap.values()].sort((a, b) => b.utime - a.utime);

  return discovered;
}

export function aggregateStats(discovered) {
  let totalBalance = parseInt(discovered.root.balance);
  for (const proxy of discovered.proxies.values()) {
    totalBalance += parseInt(proxy.balance);
  }

  let totalTonFlow = 0;
  let totalFees = 0;
  const dailyVolume = {};

  for (const tx of discovered.allTransactions) {
    const inValue = parseInt(tx.in_msg?.value || '0');
    const fee = parseInt(tx.fee || '0');
    totalTonFlow += inValue;
    totalFees += fee;

    const day = new Date(tx.utime * 1000).toISOString().slice(0, 10);
    if (!dailyVolume[day]) dailyVolume[day] = { date: day, volume: 0, txCount: 0, fees: 0 };
    dailyVolume[day].volume += inValue / 1e9;
    dailyVolume[day].txCount += 1;
    dailyVolume[day].fees += fee / 1e9;
  }

  const volumeData = Object.values(dailyVolume).sort((a, b) => a.date.localeCompare(b.date));

  let workerPayments = 0;
  let proxyFees = 0;
  for (const tx of discovered.allTransactions) {
    if (tx.contractRole === 'proxy') {
      for (const outMsg of tx.out_msgs || []) {
        const dest = outMsg.destination;
        const val = parseInt(outMsg.value || '0');
        if (discovered.workers.has(dest)) {
          workerPayments += val;
        } else {
          proxyFees += val;
        }
      }
    }
  }

  return {
    totalBalance: totalBalance / 1e9,
    proxyCount: discovered.proxies.size,
    clientCount: discovered.clients.size,
    workerCount: discovered.workers.size,
    totalTonFlow: totalTonFlow / 1e9,
    totalFees: totalFees / 1e9,
    volumeData,
    spendBreakdown: [
      { name: 'Worker Payments', value: workerPayments / 1e9 },
      { name: 'Proxy Fees', value: proxyFees / 1e9 },
      { name: 'Network Fees', value: totalFees / 1e9 },
      { name: 'Other', value: Math.max(0, (totalTonFlow - workerPayments - proxyFees) / 1e9) },
    ].filter(s => s.value > 0),
  };
}
