import { getTransactions, getAddressInfo } from '../api/toncenter';
import { getAccountInfo, classifyCocoonContract } from '../api/tonapi';
import { COCOON_SEEDS } from '../constants';

const CACHE_KEY = 'cocoon_discovery_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
    cached.data.proxies = new Map(cached.data.proxies || []);
    cached.data.clients = new Map(cached.data.clients || []);
    cached.data.workers = new Map(cached.data.workers || []);
    cached.data.cocoonWallets = new Map(cached.data.cocoonWallets || []);
    for (const proxy of cached.data.proxies.values()) {
      proxy.clients = new Map(proxy.clients || []);
      proxy.workers = new Map(proxy.workers || []);
    }
    return cached.data;
  } catch { return null; }
}

function saveCache(data) {
  try {
    const s = {
      ...data,
      proxies: [...data.proxies.entries()].map(([k, v]) => [k, {
        ...v, clients: [...(v.clients || new Map()).entries()],
        workers: [...(v.workers || new Map()).entries()],
      }]),
      clients: [...data.clients.entries()],
      workers: [...data.workers.entries()],
      cocoonWallets: [...data.cocoonWallets.entries()],
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: s }));
  } catch { /* full */ }
}

async function classifyAddress(addr) {
  try {
    const info = await getAccountInfo(addr);
    return {
      type: classifyCocoonContract(info),
      balance: String(info.balance || '0'),
      state: info.status === 'active' ? 'active' : info.status || 'unknown',
      interfaces: info.interfaces || [],
    };
  } catch {
    return { type: 'unknown', balance: '0', state: 'unknown', interfaces: [] };
  }
}

export async function discoverContracts(rootAddress) {
  const cached = loadCache();
  if (cached) {
    console.log('Using cached discovery');
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

  // Phase 1: Root info + transactions
  const [rootInfo, rootTxs] = await Promise.all([
    getAddressInfo(rootAddress),
    getTransactions(rootAddress, 50),
  ]);
  discovered.root.balance = rootInfo.balance;
  discovered.root.state = rootInfo.state;
  discovered.root.lastActivity = rootTxs[0]?.utime || 0;
  discovered.allTransactions.push(...rootTxs.map(tx => ({ ...tx, contractRole: 'root' })));

  // Phase 2: Classify seed addresses SEQUENTIALLY (avoid 429)
  const visited = new Set([rootAddress]);
  const crawlQueue = [];

  function addContract(addr, info, parentProxy) {
    const entry = {
      address: addr, balance: info.balance, state: info.state,
      type: info.type, interfaces: info.interfaces, lastActivity: 0,
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
          crawlQueue.push(addr);
        }
        break;
    }
  }

  // Classify seeds sequentially
  for (const seed of COCOON_SEEDS) {
    if (visited.has(seed)) continue;
    visited.add(seed);
    const info = await classifyAddress(seed);
    if (info.type !== 'unknown' && info.type !== 'wallet' && info.type !== 'jetton') {
      addContract(seed, info, null);
    }
  }

  // Also check addresses from root transactions sequentially
  const rootAddrs = new Set();
  for (const tx of rootTxs) {
    if (tx.in_msg?.source) rootAddrs.add(tx.in_msg.source);
    for (const m of tx.out_msgs || []) {
      if (m.destination) rootAddrs.add(m.destination);
    }
  }
  rootAddrs.delete('');
  rootAddrs.delete(rootAddress);

  for (const addr of rootAddrs) {
    if (visited.has(addr)) continue;
    visited.add(addr);
    const info = await classifyAddress(addr);
    if (info.type !== 'unknown' && info.type !== 'wallet' && info.type !== 'jetton') {
      addContract(addr, info, null);
    }
  }

  // Phase 3: BFS crawl from cocoon contracts
  let idx = 0;
  while (idx < crawlQueue.length) {
    const addr = crawlQueue[idx++];
    const isProxy = discovered.proxies.has(addr);

    try {
      const txs = await getTransactions(addr, 25);
      if (isProxy) {
        discovered.proxies.get(addr).lastActivity = txs[0]?.utime || 0;
      }
      discovered.allTransactions.push(
        ...txs.map(tx => ({ ...tx, contractRole: isProxy ? 'proxy' : 'cocoon_wallet' }))
      );

      // Find new addresses from transactions
      const newAddrs = new Set();
      for (const tx of txs) {
        if (tx.in_msg?.source && !visited.has(tx.in_msg.source)) newAddrs.add(tx.in_msg.source);
        for (const m of tx.out_msgs || []) {
          if (m.destination && !visited.has(m.destination)) newAddrs.add(m.destination);
        }
      }

      // Classify new addresses SEQUENTIALLY (max 10 per hop)
      let count = 0;
      for (const a of newAddrs) {
        if (count >= 10) break;
        visited.add(a);
        const info = await classifyAddress(a);
        if (info.type !== 'unknown' && info.type !== 'wallet' && info.type !== 'jetton') {
          addContract(a, info, isProxy ? addr : null);
        }
        count++;
      }
    } catch (err) {
      console.warn(`Crawl failed for ${addr}:`, err.message);
    }
  }

  // Deduplicate and sort transactions
  const txMap = new Map();
  for (const tx of discovered.allTransactions) {
    const key = tx.transaction_id.lt + tx.transaction_id.hash;
    if (!txMap.has(key)) txMap.set(key, tx);
  }
  discovered.allTransactions = [...txMap.values()].sort((a, b) => b.utime - a.utime);

  saveCache(discovered);
  return discovered;
}

export function aggregateStats(discovered) {
  let totalBalance = parseInt(discovered.root.balance);
  for (const p of discovered.proxies.values()) totalBalance += parseInt(p.balance);
  for (const cw of discovered.cocoonWallets.values()) totalBalance += parseInt(cw.balance);

  let totalTonFlow = 0, totalFees = 0;
  const dailyVolume = {};

  for (const tx of discovered.allTransactions) {
    const inVal = parseInt(tx.in_msg?.value || '0');
    const fee = parseInt(tx.fee || '0');
    totalTonFlow += inVal;
    totalFees += fee;
    const day = new Date(tx.utime * 1000).toISOString().slice(0, 10);
    if (!dailyVolume[day]) dailyVolume[day] = { date: day, volume: 0, txCount: 0, fees: 0 };
    dailyVolume[day].volume += inVal / 1e9;
    dailyVolume[day].txCount += 1;
    dailyVolume[day].fees += fee / 1e9;
  }

  const volumeData = Object.values(dailyVolume).sort((a, b) => a.date.localeCompare(b.date));

  let workerPayments = 0, proxyFees = 0;
  for (const tx of discovered.allTransactions) {
    if (tx.contractRole === 'proxy' || tx.contractRole === 'cocoon_wallet') {
      for (const m of tx.out_msgs || []) {
        const val = parseInt(m.value || '0');
        if (discovered.workers.has(m.destination)) workerPayments += val;
        else if (!discovered.proxies.has(m.destination) && !discovered.cocoonWallets.has(m.destination)
                 && m.destination !== discovered.root.address) proxyFees += val;
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
