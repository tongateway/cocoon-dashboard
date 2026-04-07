import { getTransactions, getAddressInfo } from '../api/toncenter';
import { getAccountInfo, classifyCocoonContract } from '../api/tonapi';

export async function discoverContracts(rootAddress) {
  const discovered = {
    root: { address: rootAddress, balance: '0', state: 'unknown', lastActivity: 0 },
    proxies: new Map(),
    clients: new Map(),
    workers: new Map(),
    cocoonWallets: new Map(),
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

  // Phase 3: Classify each address using tonapi.io interfaces
  const addressChecks = await Promise.allSettled(
    [...interactingAddresses].map(async addr => {
      try {
        const info = await getAccountInfo(addr);
        const type = classifyCocoonContract(info);
        return {
          address: addr,
          balance: String(info.balance || '0'),
          state: info.status === 'active' ? 'active' : info.status || 'unknown',
          type,
          interfaces: info.interfaces || [],
          isWallet: info.is_wallet || false,
        };
      } catch {
        // Fallback to toncenter if tonapi fails
        const tcInfo = await getAddressInfo(addr);
        return {
          address: addr,
          balance: tcInfo.balance,
          state: tcInfo.state,
          type: 'unknown',
          interfaces: [],
          isWallet: !tcInfo.code || tcInfo.code.length < 300,
        };
      }
    })
  );

  // Sort into categories
  const cocoonAddresses = new Set(); // Track cocoon-related addresses for deep crawl
  for (const result of addressChecks) {
    if (result.status !== 'fulfilled') continue;
    const info = result.value;

    const entry = {
      address: info.address,
      balance: info.balance,
      state: info.state,
      type: info.type,
      interfaces: info.interfaces,
      lastActivity: 0,
    };

    switch (info.type) {
      case 'proxy':
        entry.clients = new Map();
        entry.workers = new Map();
        discovered.proxies.set(info.address, entry);
        cocoonAddresses.add(info.address);
        break;
      case 'client':
        discovered.clients.set(info.address, { ...entry, proxyAddress: null });
        cocoonAddresses.add(info.address);
        break;
      case 'worker':
        discovered.workers.set(info.address, { ...entry, proxyAddress: null });
        cocoonAddresses.add(info.address);
        break;
      case 'cocoon_wallet':
        discovered.cocoonWallets.set(info.address, entry);
        cocoonAddresses.add(info.address);
        break;
      // Skip wallets, jettons, unknown
    }
  }

  // Phase 4: Deep crawl — for each cocoon contract, discover more
  const crawlQueue = [...cocoonAddresses];
  const visited = new Set([rootAddress, ...cocoonAddresses]);

  for (const addr of crawlQueue) {
    try {
      const txs = await getTransactions(addr, 20);
      const contractType = discovered.proxies.has(addr) ? 'proxy' :
                           discovered.cocoonWallets.has(addr) ? 'cocoon_wallet' : 'other';

      if (discovered.proxies.has(addr)) {
        discovered.proxies.get(addr).lastActivity = txs[0]?.utime || 0;
      }

      discovered.allTransactions.push(
        ...txs.map(tx => ({ ...tx, contractRole: contractType }))
      );

      // Discover new addresses from transactions
      const newAddrs = new Set();
      for (const tx of txs) {
        const src = tx.in_msg?.source;
        const dst = tx.in_msg?.destination;
        if (src && !visited.has(src)) newAddrs.add(src);
        for (const m of tx.out_msgs || []) {
          if (m.destination && !visited.has(m.destination)) newAddrs.add(m.destination);
        }
      }

      // Classify new addresses (batch, limit to avoid rate limits)
      const newChecks = await Promise.allSettled(
        [...newAddrs].slice(0, 15).map(async a => {
          visited.add(a);
          try {
            const info = await getAccountInfo(a);
            return {
              address: a,
              balance: String(info.balance || '0'),
              state: info.status === 'active' ? 'active' : info.status || 'unknown',
              type: classifyCocoonContract(info),
              interfaces: info.interfaces || [],
            };
          } catch {
            return { address: a, type: 'unknown' };
          }
        })
      );

      for (const result of newChecks) {
        if (result.status !== 'fulfilled') continue;
        const info = result.value;

        const entry = {
          address: info.address,
          balance: info.balance,
          state: info.state,
          type: info.type,
          interfaces: info.interfaces,
          proxyAddress: discovered.proxies.has(addr) ? addr : null,
          lastActivity: 0,
        };

        switch (info.type) {
          case 'proxy':
            if (!discovered.proxies.has(info.address)) {
              entry.clients = new Map();
              entry.workers = new Map();
              discovered.proxies.set(info.address, entry);
              crawlQueue.push(info.address);
            }
            break;
          case 'client':
            if (!discovered.clients.has(info.address)) {
              discovered.clients.set(info.address, entry);
              // Link to parent proxy
              if (discovered.proxies.has(addr)) {
                discovered.proxies.get(addr).clients.set(info.address, entry);
              }
            }
            break;
          case 'worker':
            if (!discovered.workers.has(info.address)) {
              discovered.workers.set(info.address, entry);
              if (discovered.proxies.has(addr)) {
                discovered.proxies.get(addr).workers.set(info.address, entry);
              }
            }
            break;
          case 'cocoon_wallet':
            if (!discovered.cocoonWallets.has(info.address)) {
              discovered.cocoonWallets.set(info.address, entry);
              crawlQueue.push(info.address);
            }
            break;
        }
      }
    } catch (err) {
      console.warn(`Failed to crawl ${addr}:`, err.message);
    }
  }

  // Deduplicate and sort transactions
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
  for (const cw of discovered.cocoonWallets.values()) {
    totalBalance += parseInt(cw.balance);
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
    if (tx.contractRole === 'proxy' || tx.contractRole === 'cocoon_wallet') {
      for (const outMsg of tx.out_msgs || []) {
        const dest = outMsg.destination;
        const val = parseInt(outMsg.value || '0');
        if (discovered.workers.has(dest)) {
          workerPayments += val;
        } else if (!discovered.proxies.has(dest) && !discovered.cocoonWallets.has(dest)) {
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
    cocoonWalletCount: discovered.cocoonWallets.size,
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
