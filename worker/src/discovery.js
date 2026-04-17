// Incremental contract discovery for Cloudflare Worker
// Designed to run in chunks within 30s CPU limit

import { classifyByCode, getCodeHash } from './codehash.js';
import { extractOp, scanOpcodes } from './opcodes.js';
import { toEQ } from './address.js';

const MAX_CLASSIFY_PER_RUN = 150;

export async function runDiscovery(tc, kv, rootContract) {
  console.log('[discover] start');
  const result = { root: {}, proxies: [], clients: [], workers: [], cocoonWallets: [], relatedWallets: [], transactions: [] };

  // 1. Root info + all txs (8 pages ≈ 400 recent txs for opcode routing)
  const rootInfo = await tc.getAddressInfo(rootContract);
  const rootType = await classifyByCode(rootInfo.code);
  const rootTxs = await tc.getAllTxs(rootContract, 8);

  result.root = {
    address: rootContract, balance: rootInfo.balance, state: rootInfo.state, type: rootType,
    codeHash: await getCodeHash(rootInfo.code), lastActivity: rootTxs[0]?.utime || 0,
  };
  result.transactions.push(...rootTxs.map(tx => ({ ...tx, contractRole: 'root' })));

  // 2. Find opcode-sending addresses in root txs
  const visited = new Set([rootContract, '']);
  const cocoonQueue = [];
  const opcodeAddrs = new Set();

  for (const tx of rootTxs) {
    const src = tx.in_msg?.source;
    const inOp = extractOp(tx.in_msg?.msg_data?.body);
    if (src && inOp && inOp !== 'excesses' && inOp !== 'payout') opcodeAddrs.add(src);
    for (const m of tx.out_msgs || []) {
      if (m.destination) {
        const outOp = extractOp(m.msg_data?.body);
        if (outOp && outOp === 'excesses') opcodeAddrs.add(m.destination);
      }
    }
  }

  console.log(`[discover] ${opcodeAddrs.size} opcode addrs, 2-hop scanning...`);

  // 3. Classify opcode addresses + their peers (2-hop)
  for (const addr of opcodeAddrs) {
    visited.add(addr);
    try {
      const classified = await classifyAddr(tc, addr);
      addToResult(result, classified, null, cocoonQueue);
    } catch {}

    try {
      const txs = await tc.getAllTxs(addr, 3);
      const peers = new Set();
      for (const tx of txs) {
        if (tx.in_msg?.source) peers.add(tx.in_msg.source);
        for (const m of tx.out_msgs || []) { if (m.destination) peers.add(m.destination); }
      }
      for (const p of peers) {
        if (visited.has(p)) continue;
        visited.add(p);
        try {
          const classified = await classifyAddr(tc, p);
          addToResult(result, classified, null, cocoonQueue);
        } catch {}
      }
    } catch {}
  }

  console.log(`[discover] after 2-hop: ${result.proxies.length}P ${result.clients.length}C ${result.workers.length}W`);

  // 4. BFS crawl from cocoon contracts (5 pages ≈ 250 txs per contract for deeper history)
  let idx = 0, classified = 0;
  while (idx < cocoonQueue.length && classified < MAX_CLASSIFY_PER_RUN) {
    const { address: addr, type } = cocoonQueue[idx++];
    try {
      const txs = await tc.getAllTxs(addr, 5);
      const entry = findEntry(result, addr);
      if (entry) entry.lastActivity = txs[0]?.utime || 0;
      result.transactions.push(...txs.map(tx => ({ ...tx, contractRole: type })));

      const newAddrs = new Set();
      for (const tx of txs) {
        if (tx.in_msg?.source && !visited.has(tx.in_msg.source)) newAddrs.add(tx.in_msg.source);
        for (const m of tx.out_msgs || []) {
          if (m.destination && !visited.has(m.destination)) newAddrs.add(m.destination);
        }
      }
      for (const a of newAddrs) {
        if (classified >= MAX_CLASSIFY_PER_RUN) break;
        visited.add(a);
        try {
          const c = await classifyAddr(tc, a);
          addToResult(result, c, type === 'cocoon_proxy' ? addr : null, cocoonQueue);
          classified++;
        } catch {}
      }
    } catch {}
  }

  // 5. Load known addresses from KV and check any not yet visited
  try {
    const knownRaw = await kv.get('known_cocoon_addrs', 'json');
    const known = knownRaw || [];
    let newFromKnown = 0;
    for (const addr of known) {
      if (visited.has(addr)) continue;
      visited.add(addr);
      try {
        const c = await classifyAddr(tc, addr);
        addToResult(result, c, null, cocoonQueue);
        if (c.type.startsWith('cocoon_')) newFromKnown++;
      } catch {}
    }
    if (newFromKnown > 0) console.log(`[discover] ${newFromKnown} from known addrs`);
  } catch {}

  // Save known addresses
  const allCocoonAddrs = [
    ...result.proxies.map(p => p.address),
    ...result.clients.map(c => c.address),
    ...result.workers.map(w => w.address),
    ...result.cocoonWallets.map(w => w.address),
  ];
  try {
    const existing = (await kv.get('known_cocoon_addrs', 'json')) || [];
    await kv.put('known_cocoon_addrs', JSON.stringify([...new Set([...existing, ...allCocoonAddrs])]));
  } catch {}

  // Dedup txs
  const txMap = new Map();
  for (const tx of result.transactions) txMap.set(tx.transaction_id.lt + tx.transaction_id.hash, tx);
  result.transactions = [...txMap.values()].sort((a, b) => b.utime - a.utime);

  // 6b. Ensure ALL discovered proxies, clients, and workers have their txs crawled
  const criticalContracts = [...result.proxies, ...result.clients, ...result.workers];
  for (const contract of criticalContracts) {
    // Check if we already have txs for this contract
    const hasTxs = result.transactions.some(tx => tx.contractRole === contract.type &&
      (tx.in_msg?.destination === contract.address || tx.address?.account_address === contract.address));
    if (hasTxs) continue;

    try {
      const txs = await tc.getAllTxs(contract.address, 5);
      contract.lastActivity = txs[0]?.utime || 0;
      result.transactions.push(...txs.map(tx => ({ ...tx, contractRole: contract.type })));
    } catch {}
  }

  // 7. Compute real token/revenue metrics from opcodes + contract types
  const proxyAddrs = new Set(result.proxies.map(p => p.address));
  const clientAddrs = new Set(result.clients.map(c => c.address));
  const workerAddrs = new Set(result.workers.map(w => w.address));
  const walletAddrs = new Set(result.cocoonWallets.map(w => w.address));

  // Only count each flow ONCE from the correct contract's perspective:
  // - Compute spend: IN to proxy (client_proxy_request) + IN to client (ext_client_charge_signed)
  // - Worker revenue: IN to worker (ext_worker_payout_signed)

  const dailyMetrics = {};
  let totalComputeSpend = 0, totalWorkerRevenue = 0;

  for (const tx of result.transactions) {
    const role = tx.contractRole;
    const day = new Date(tx.utime * 1000).toISOString().slice(0, 10);
    if (!dailyMetrics[day]) dailyMetrics[day] = { date: day, computeSpend: 0, workerRevenue: 0, computeTxs: 0 };

    const inOp = extractOp(tx.in_msg?.msg_data?.body);
    const inVal = parseInt(tx.in_msg?.value || '0');

    // Compute spend: client charges (only from proxy or client contract perspective)
    if (role === 'cocoon_proxy' && inOp === 'client_proxy_request' && inVal > 0) {
      dailyMetrics[day].computeSpend += inVal;
      dailyMetrics[day].computeTxs++;
      totalComputeSpend += inVal;
    }
    if (role === 'cocoon_client' && inOp === 'ext_client_charge_signed' && inVal > 0) {
      dailyMetrics[day].computeSpend += inVal;
      dailyMetrics[day].computeTxs++;
      totalComputeSpend += inVal;
    }

    // Worker revenue: payouts received by workers
    if (role === 'cocoon_worker' && inOp === 'ext_worker_payout_signed' && inVal > 0) {
      dailyMetrics[day].workerRevenue += inVal;
      totalWorkerRevenue += inVal;
    }
  }

  // Convert to arrays and add token estimates
  // price_per_token = 20 nanoTON, avg ~3x multiplier = 60 nanoTON effective
  const pricePerToken = 20; // nanoTON base from root contract
  result.computeMetrics = {
    daily: Object.values(dailyMetrics)
      .map(d => ({
        date: d.date,
        computeSpendTon: d.computeSpend / 1e9,
        workerRevenueTon: d.workerRevenue / 1e9,
        computeTxs: d.computeTxs,
        // Token estimates at different multipliers
        tokensPrompt: Math.round(d.computeSpend / pricePerToken),          // 1x
        tokensCompletion: Math.round(d.computeSpend / (pricePerToken * 8)), // 8x
        tokensMix: Math.round(d.computeSpend / (pricePerToken * 3)),        // ~3x avg
      }))
      .filter(d => d.computeSpendTon > 0 || d.workerRevenueTon > 0)
      .sort((a, b) => a.date.localeCompare(b.date)),
    totals: {
      computeSpendTon: totalComputeSpend / 1e9,
      workerRevenueTon: totalWorkerRevenue / 1e9,
      tokensPrompt: Math.round(totalComputeSpend / pricePerToken),
      tokensCompletion: Math.round(totalComputeSpend / (pricePerToken * 8)),
      tokensMix: Math.round(totalComputeSpend / (pricePerToken * 3)),
    },
  };

  // 8. Truncate raw tx list to the most recent 800 so the payload fits KV's 25MB limit.
  // Historical aggregates are preserved in computeMetrics.daily (already computed from all txs).
  const MAX_TXS_IN_CACHE = 800;
  if (result.transactions.length > MAX_TXS_IN_CACHE) {
    const dropped = result.transactions.length - MAX_TXS_IN_CACHE;
    result.transactions = result.transactions.slice(0, MAX_TXS_IN_CACHE);
    console.log(`[discover] truncated ${dropped} older txs from payload (kept newest ${MAX_TXS_IN_CACHE})`);
  }

  console.log(`[discover] compute: ${result.computeMetrics.totals.computeSpendTon.toFixed(2)} TON spent, ~${formatNum(result.computeMetrics.totals.tokensMix)} tokens (mix)`);
  console.log(`[discover] done: ${result.proxies.length}P ${result.clients.length}C ${result.workers.length}W ${result.cocoonWallets.length}CW`);
  return result;
}

function formatNum(n) {
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(0)+'K';
  return String(n);
}

async function classifyAddr(tc, addr) {
  const info = await tc.getAddressInfo(addr);
  const type = await classifyByCode(info.code);
  return { address: addr, balance: info.balance, state: info.state, type, codeHash: await getCodeHash(info.code) };
}

function addToResult(result, classified, parentProxy, queue) {
  const { address, type } = classified;
  const entry = { ...classified, lastActivity: 0 };

  switch (type) {
    case 'cocoon_proxy':
      if (!result.proxies.find(p => p.address === address)) {
        entry.clients = []; entry.workers = [];
        result.proxies.push(entry);
        queue.push({ address, type });
      }
      break;
    case 'cocoon_client':
      if (!result.clients.find(c => c.address === address)) {
        entry.proxyAddress = parentProxy;
        result.clients.push(entry);
        if (parentProxy) {
          const proxy = result.proxies.find(p => p.address === parentProxy);
          if (proxy) proxy.clients.push(address);
        }
        queue.push({ address, type });
      }
      break;
    case 'cocoon_worker':
      if (!result.workers.find(w => w.address === address)) {
        entry.proxyAddress = parentProxy;
        result.workers.push(entry);
        if (parentProxy) {
          const proxy = result.proxies.find(p => p.address === parentProxy);
          if (proxy) proxy.workers.push(address);
        }
        queue.push({ address, type });
      }
      break;
    case 'cocoon_wallet':
      if (!result.cocoonWallets.find(w => w.address === address)) {
        result.cocoonWallets.push(entry);
        queue.push({ address, type });
      }
      break;
    default:
      if (parentProxy && type !== 'no_code') {
        if (!result.relatedWallets.find(w => w.address === address)) {
          entry.proxyAddress = parentProxy;
          result.relatedWallets.push(entry);
        }
      }
  }
}

function findEntry(result, addr) {
  return result.proxies.find(p => p.address === addr)
    || result.clients.find(c => c.address === addr)
    || result.workers.find(w => w.address === addr)
    || result.cocoonWallets.find(w => w.address === addr);
}
