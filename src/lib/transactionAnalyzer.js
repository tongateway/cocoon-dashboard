import { getTransactions, getAddressInfo } from '../api/toncenter';

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

  // Phase 2: Extract unique interacting addresses from root transactions
  const interactingAddresses = new Set();
  for (const tx of rootTxs) {
    if (tx.in_msg?.source) interactingAddresses.add(tx.in_msg.source);
    for (const outMsg of tx.out_msgs || []) {
      if (outMsg.destination) interactingAddresses.add(outMsg.destination);
    }
  }
  interactingAddresses.delete('');
  interactingAddresses.delete(rootAddress);

  // Phase 3: Check each interacting address — filter out simple wallets
  // Known wallet code hashes (WalletV3, V4, V5, etc.) should be excluded
  const WALLET_CODE_PREFIXES = [
    'te6cckEBAQEAcQAA3v8AIN0gggFMl7ohggEznLqxn', // WalletV3R2
    'te6cckECFQEAAtQAART/APSkE/S88sgLAQIBIAID', // WalletV4R2
    'te6cckECFQEAAtQAART/APSkE/S88sgLAQIBYgID', // WalletV4
    'te6cckEBAQEAIwAIQgLkzzsvTYz', // SimpleWallet
  ];

  function isLikelyWallet(codeBase64) {
    if (!codeBase64) return false;
    // Wallet contracts are typically short (< 1KB base64)
    if (codeBase64.length < 600) return true;
    return WALLET_CODE_PREFIXES.some(prefix => codeBase64.startsWith(prefix));
  }

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

    // Skip simple wallet contracts — they're not Cocoon proxies
    if (isLikelyWallet(info.code)) continue;

    // Also skip if the only interaction was a tiny value (spam/dust)
    const txsWithAddr = rootTxs.filter(tx =>
      tx.in_msg?.source === info.address ||
      (tx.out_msgs || []).some(m => m.destination === info.address)
    );
    const totalValue = txsWithAddr.reduce((sum, tx) => {
      if (tx.in_msg?.source === info.address) return sum + parseInt(tx.in_msg.value || '0');
      return sum;
    }, 0);
    // Skip if total interaction value < 0.01 TON (likely spam)
    if (totalValue < 10_000_000) continue;

    discovered.proxies.set(info.address, {
      address: info.address,
      balance: info.balance,
      state: info.state,
      clients: new Map(),
      workers: new Map(),
      lastActivity: 0,
    });
  }

  // Phase 4: For each proxy, fetch transactions to discover clients/workers
  const proxyTxPromises = [...discovered.proxies.keys()].map(async proxyAddr => {
    try {
      const txs = await getTransactions(proxyAddr, 30);
      const proxy = discovered.proxies.get(proxyAddr);
      proxy.lastActivity = txs[0]?.utime || 0;

      discovered.allTransactions.push(
        ...txs.map(tx => ({ ...tx, contractRole: 'proxy' }))
      );

      const childAddrs = new Set();
      for (const tx of txs) {
        if (tx.in_msg?.source && tx.in_msg.source !== rootAddress) {
          childAddrs.add(tx.in_msg.source);
        }
        for (const outMsg of tx.out_msgs || []) {
          if (outMsg.destination && outMsg.destination !== rootAddress) {
            childAddrs.add(outMsg.destination);
          }
        }
      }

      const childChecks = await Promise.allSettled(
        [...childAddrs].slice(0, 20).map(async addr => {
          const info = await getAddressInfo(addr);
          return { address: addr, balance: info.balance, state: info.state, hasCode: !!info.code };
        })
      );

      for (const result of childChecks) {
        if (result.status !== 'fulfilled') continue;
        const child = result.value;
        if (child.state !== 'active') continue;

        if (child.hasCode) {
          const sendsToProxy = txs.some(tx => tx.in_msg?.source === child.address);
          const receivesFromProxy = txs.some(tx =>
            (tx.out_msgs || []).some(m => m.destination === child.address)
          );

          if (receivesFromProxy && !sendsToProxy) {
            discovered.workers.set(child.address, {
              address: child.address,
              balance: child.balance,
              proxyAddress: proxyAddr,
            });
            proxy.workers.set(child.address, child);
          } else {
            discovered.clients.set(child.address, {
              address: child.address,
              balance: child.balance,
              proxyAddress: proxyAddr,
            });
            proxy.clients.set(child.address, child);
          }
        }
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
