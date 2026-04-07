import { getTransactions, getAddressInfo } from '../api/toncenter';
import { getAccountInfo, classifyCocoonContract } from '../api/tonapi';

const CACHE_KEY = 'cocoon_discovery_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
    // Restore Maps from arrays
    cached.data.proxies = new Map(cached.data.proxies || []);
    cached.data.clients = new Map(cached.data.clients || []);
    cached.data.workers = new Map(cached.data.workers || []);
    cached.data.cocoonWallets = new Map(cached.data.cocoonWallets || []);
    for (const proxy of cached.data.proxies.values()) {
      proxy.clients = new Map(proxy.clients || []);
      proxy.workers = new Map(proxy.workers || []);
    }
    return cached.data;
  } catch {
    return null;
  }
}

function saveCache(data) {
  try {
    const serializable = {
      ...data,
      proxies: [...data.proxies.entries()].map(([k, v]) => [k, {
        ...v,
        clients: [...(v.clients || new Map()).entries()],
        workers: [...(v.workers || new Map()).entries()],
      }]),
      clients: [...data.clients.entries()],
      workers: [...data.workers.entries()],
      cocoonWallets: [...data.cocoonWallets.entries()],
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: serializable }));
  } catch {
    // localStorage might be full
  }
}

async function classifyAddress(address) {
  try {
    const info = await getAccountInfo(address);
    return {
      type: classifyCocoonContract(info),
      balance: String(info.balance || '0'),
      state: info.status === 'active' ? 'active' : info.status || 'unknown',
      interfaces: info.interfaces || [],
      isWallet: info.is_wallet || false,
    };
  } catch {
    return { type: 'unknown', balance: '0', state: 'unknown', interfaces: [], isWallet: false };
  }
}

export async function discoverContracts(rootAddress) {
  // Try cache first
  const cached = loadCache();
  if (cached) {
    console.log('Using cached discovery data');
    return cached;
  }

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

  // Phase 2: Extract all addresses from root transactions
  const allAddresses = new Set();
  for (const tx of rootTxs) {
    if (tx.in_msg?.source) allAddresses.add(tx.in_msg.source);
    for (const outMsg of tx.out_msgs || []) {
      if (outMsg.destination) allAddresses.add(outMsg.destination);
    }
  }
  allAddresses.delete('');
  allAddresses.delete(rootAddress);

  // Phase 3: Classify each address via tonapi.io
  const classified = await Promise.allSettled(
    [...allAddresses].map(async addr => {
      const info = await classifyAddress(addr);
      return { address: addr, ...info };
    })
  );

  // Phase 4: BFS crawl — start from cocoon contracts found in root txs
  const visited = new Set([rootAddress, ...allAddresses]);
  const crawlQueue = [];

  function addContract(addr, info, parentProxy) {
    const entry = {
      address: addr,
      balance: info.balance,
      state: info.state,
      type: info.type,
      interfaces: info.interfaces,
      lastActivity: 0,
    };

    switch (info.type) {
      case 'proxy':
        if (!discovered.proxies.has(addr)) {
          entry.clients = new Map();
          entry.workers = new Map();
          discovered.proxies.set(addr, entry);
          crawlQueue.push(addr);
        }
        break;
      case 'client':
        if (!discovered.clients.has(addr)) {
          entry.proxyAddress = parentProxy || null;
          discovered.clients.set(addr, entry);
          if (parentProxy && discovered.proxies.has(parentProxy)) {
            discovered.proxies.get(parentProxy).clients.set(addr, entry);
          }
        }
        break;
      case 'worker':
        if (!discovered.workers.has(addr)) {
          entry.proxyAddress = parentProxy || null;
          discovered.workers.set(addr, entry);
          if (parentProxy && discovered.proxies.has(parentProxy)) {
            discovered.proxies.get(parentProxy).workers.set(addr, entry);
          }
        }
        break;
      case 'cocoon_wallet':
        if (!discovered.cocoonWallets.has(addr)) {
          discovered.cocoonWallets.set(addr, entry);
          crawlQueue.push(addr); // Crawl from wallets too — they link to proxies
        }
        break;
    }
  }

  // Add contracts found in Phase 3
  for (const result of classified) {
    if (result.status !== 'fulfilled') continue;
    const info = result.value;
    if (info.type !== 'unknown' && info.type !== 'wallet' && info.type !== 'jetton') {
      addContract(info.address, info, null);
    }
  }

  // BFS crawl from cocoon contracts
  let crawlIndex = 0;
  while (crawlIndex < crawlQueue.length) {
    const addr = crawlQueue[crawlIndex++];
    const isCocoonProxy = discovered.proxies.has(addr);

    try {
      const txs = await getTransactions(addr, 25);

      // Update last activity
      if (discovered.proxies.has(addr)) {
        discovered.proxies.get(addr).lastActivity = txs[0]?.utime || 0;
      }

      discovered.allTransactions.push(
        ...txs.map(tx => ({
          ...tx,
          contractRole: discovered.proxies.has(addr) ? 'proxy' : 'cocoon_wallet',
        }))
      );

      // Find new addresses
      const newAddrs = new Set();
      for (const tx of txs) {
        const src = tx.in_msg?.source;
        if (src && !visited.has(src)) newAddrs.add(src);
        for (const m of tx.out_msgs || []) {
          if (m.destination && !visited.has(m.destination)) newAddrs.add(m.destination);
        }
      }

      // Classify new addresses (limit batch to avoid rate limits)
      const batch = [...newAddrs].slice(0, 15);
      for (const a of batch) visited.add(a);

      const results = await Promise.allSettled(
        batch.map(async a => {
          const info = await classifyAddress(a);
          return { address: a, ...info };
        })
      );

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const info = result.value;
        if (info.type !== 'unknown' && info.type !== 'wallet' && info.type !== 'jetton') {
          addContract(info.address, info, isCocoonProxy ? addr : null);
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

  // Cache results
  saveCache(discovered);

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
        } else if (!discovered.proxies.has(dest) && !discovered.cocoonWallets.has(dest)
                   && dest !== discovered.root.address) {
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
