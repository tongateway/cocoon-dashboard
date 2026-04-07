import 'dotenv/config';
import { createServer } from 'http';
import axios from 'axios';
import crypto from 'crypto';
import { Cell } from '@ton/core';

const { TONCENTER_API_KEY, ROOT_CONTRACT, PORT = 3001 } = process.env;

const tc = axios.create({
  baseURL: 'https://toncenter.com/api/v2',
  headers: { 'X-API-Key': TONCENTER_API_KEY },
  timeout: 15_000,
});

function unwrap(r) {
  if (!r.data.ok) throw new Error(r.data.error || 'toncenter error');
  return r.data.result;
}

// --- Contract type detection by code hash ---
// These hashes are SHA256 of the base64-decoded contract code, first 16 hex chars
const CODE_TYPES = {
  'cfd7fb56c93c4e68': 'cocoon_root',
  '4693d2a95d0e55d4': 'cocoon_proxy',
  '3204b6ab0ec40172': 'cocoon_client',
  '8641e3b7669e0366': 'cocoon_worker',
  '2051342c307e220a': 'cocoon_wallet',
};

function getCodeHash(codeBase64) {
  if (!codeBase64) return null;
  return crypto.createHash('sha256').update(Buffer.from(codeBase64, 'base64')).digest('hex').slice(0, 16);
}

function classifyByCode(codeBase64) {
  const hash = getCodeHash(codeBase64);
  if (!hash) return 'no_code';
  return CODE_TYPES[hash] || 'unknown';
}

// --- Opcodes ---
const OP = {0x2565934c:'excesses',0xc59a7cd3:'payout',0x9a1247c0:'do_not_process',0xe34b1c60:'root_add_worker_type',0x8d94a79a:'root_del_worker_type',0x71860e80:'root_add_proxy_type',0x3c41d0b2:'root_del_proxy_type',0x927c7cb5:'root_register_proxy',0x6d49eaf2:'root_unregister_proxy',0x9c7924ba:'root_update_proxy',0xc52ed8d4:'root_change_price',0xa2370f61:'root_upgrade_contracts',0x11aefd51:'root_upgrade',0x563c1d96:'root_reset',0x4f7c5789:'root_upgrade_full',0x4d725d2c:'worker_proxy_request',0x08e7d036:'worker_proxy_payout',0xa040ad28:'ext_worker_payout_signed',0xf5f26a36:'ext_worker_last_payout',0x26ed7f65:'owner_worker_register',0x65448ff4:'client_proxy_request',0x5cfc6b87:'client_proxy_top_up',0xa35cb580:'client_proxy_register',0xc68ebc7b:'client_proxy_refund',0xf4c354c9:'client_proxy_refund_force',0xf172e6c2:'ext_client_top_up',0xbb63ff93:'ext_client_charge_signed',0xefd711e1:'ext_client_refund_signed',0x29111ceb:'owner_client_reopen',0xc45f9f3b:'owner_client_register',0xa9357034:'owner_client_change_secret',0x8473b408:'owner_client_secret_topup',0xfafa6cc1:'owner_client_refund',0x6a1f6a60:'owner_client_increase_stake',0xda068e78:'owner_client_withdraw',0x9713f187:'ext_proxy_increase_stake',0x7610e6eb:'ext_proxy_payout',0xb51d5a01:'owner_proxy_close',0x636a4391:'ext_proxy_close_signed',0xe511abc7:'ext_proxy_close_complete',0x53109c0f:'proxy_save_state',0x9c69f376:'owner_wallet_send'};

function extractOp(b64) {
  if (!b64) return null;
  try {
    const raw = Buffer.from(b64, 'base64');
    for (let o = 4; o < Math.min(20, raw.length - 3); o++) {
      const op = raw.readUInt32BE(o);
      if (OP[op]) return OP[op];
    }
  } catch {}
  return null;
}

// --- Root contract BOC parser ---
function parseRootContract(dataBase64) {
  try {
    const cell = Cell.fromBase64(dataBase64);
    const cs = cell.beginParse();

    const owner = cs.loadAddress()?.toString() || null;
    cs.loadUint(32); // version/extra

    const dataRef = cs.loadRef();
    const paramsRef = cs.loadRef();

    // Parse params
    const pcs = paramsRef.beginParse();
    const loadCoins = (s) => { const len = s.loadUint(4); return len === 0 ? 0n : s.loadUintBig(len * 8); };

    const structVersion = pcs.loadUint(8);
    const paramsVersion = pcs.loadUint(32);
    const uniqueId = pcs.loadUint(32);
    const isTest = pcs.loadBit();
    const pricePerToken = Number(loadCoins(pcs));
    const workerFeePerToken = Number(loadCoins(pcs));

    let promptMul = 10000, cachedMul = 10000, completionMul = 10000, reasoningMul = 10000;
    if (structVersion >= 3) promptMul = pcs.loadUint(32);
    if (structVersion >= 2) cachedMul = pcs.loadUint(32);
    if (structVersion >= 3) completionMul = pcs.loadUint(32);
    if (structVersion >= 2) reasoningMul = pcs.loadUint(32);

    const proxyDelayBeforeClose = pcs.loadUint(32);
    const clientDelayBeforeClose = pcs.loadUint(32);

    let minProxyStake = 1000000000, minClientStake = 1000000000;
    if (structVersion >= 1) minProxyStake = Number(loadCoins(pcs));
    if (structVersion >= 1) minClientStake = Number(loadCoins(pcs));

    // Parse data cell for proxy IPs
    const dcs = dataRef.beginParse();
    dcs.loadBit(); // hasProxyHashes
    if (dcs.remainingRefs > 0) dcs.loadRef(); // proxy hashes dict

    const proxyIPs = [];
    const hasProxy = dcs.remainingBits > 0 ? dcs.loadBit() : false;
    if (hasProxy && dcs.remainingRefs > 0) {
      const pxRef = dcs.loadRef();
      const pxcs = pxRef.beginParse();
      pxcs.loadUint(8); // type
      const remaining = pxcs.remainingBits;
      if (remaining > 0) {
        const buf = pxcs.loadBuffer(Math.floor(remaining / 8));
        const str = buf.toString('utf8').replace(/[^\x20-\x7E]/g, '').trim();
        proxyIPs.push(...str.split(' ').filter(s => s.includes(':')));
      }
    }

    let lastProxySeqno = 0;
    if (dcs.remainingBits >= 32) lastProxySeqno = dcs.loadUint(32);

    return {
      owner,
      structVersion,
      paramsVersion,
      uniqueId,
      isTest,
      pricePerToken,
      workerFeePerToken,
      promptMultiplier: promptMul,
      cachedMultiplier: cachedMul,
      completionMultiplier: completionMul,
      reasoningMultiplier: reasoningMul,
      proxyDelayBeforeClose,
      clientDelayBeforeClose,
      minProxyStake,
      minClientStake,
      proxyIPs,
      lastProxySeqno,
    };
  } catch (e) {
    console.warn('[parseRoot] error:', e.message);
    return null;
  }
}

// --- Cache ---
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 120_000;

// --- Discovery ---
async function getAllTxs(address, maxPages = 3) {
  let all = [];
  let lt, hash;
  for (let i = 0; i < maxPages; i++) {
    const params = { address, limit: 50 };
    if (lt) { params.lt = lt; params.hash = hash; }
    const txs = unwrap(await tc.get('/getTransactions', { params }));
    all.push(...txs);
    if (txs.length < 50) break;
    const last = txs[txs.length - 1];
    lt = last.transaction_id.lt;
    hash = last.transaction_id.hash;
  }
  return all;
}

async function getInfoAndClassify(address) {
  const info = unwrap(await tc.get('/getAddressInformation', { params: { address } }));
  const type = classifyByCode(info.code);
  return { address, balance: info.balance, state: info.state, type, codeHash: getCodeHash(info.code) };
}

async function discover() {
  console.log('[discover] start');
  const result = { root: {}, proxies: [], clients: [], workers: [], cocoonWallets: [], relatedWallets: [], transactions: [] };

  // 1. Root info + all txs
  const [rootInfo, rootTxs] = await Promise.all([
    getInfoAndClassify(ROOT_CONTRACT),
    getAllTxs(ROOT_CONTRACT, 3),
  ]);
  // Parse root contract BOC data
  const fullRootInfo = unwrap(await tc.get('/getAddressInformation', { params: { address: ROOT_CONTRACT } }));
  const rootConfig = fullRootInfo.data ? parseRootContract(fullRootInfo.data) : null;

  result.root = { ...rootInfo, lastActivity: rootTxs[0]?.utime || 0, config: rootConfig };
  result.transactions.push(...rootTxs.map(tx => ({ ...tx, contractRole: 'root' })));

  // 2. Find wallets sending cocoon opcodes in root txs
  const visited = new Set([ROOT_CONTRACT, '']);
  const cocoonQueue = []; // BFS queue for cocoon contracts
  const relatedWallets = new Set(); // wallets that send cocoon opcodes

  for (const tx of rootTxs) {
    const src = tx.in_msg?.source;
    const inOp = extractOp(tx.in_msg?.msg_data?.body);
    if (src && inOp && inOp !== 'excesses' && inOp !== 'payout') relatedWallets.add(src);
    for (const m of tx.out_msgs || []) {
      if (m.destination) {
        const outOp = extractOp(m.msg_data?.body);
        if (outOp && outOp === 'excesses') relatedWallets.add(m.destination); // excesses → owner wallet
      }
    }
  }

  console.log(`[discover] ${relatedWallets.size} related wallets from ${rootTxs.length} root txs`);

  // 3. Crawl related wallets to find actual cocoon contracts by code hash
  for (const walletAddr of relatedWallets) {
    visited.add(walletAddr);
    try {
      const walletTxs = await getAllTxs(walletAddr, 1);
      result.transactions.push(...walletTxs.map(tx => ({ ...tx, contractRole: 'related_wallet' })));

      // Check all addresses in wallet's txs
      for (const tx of walletTxs) {
        const addrs = [tx.in_msg?.source];
        for (const m of tx.out_msgs || []) addrs.push(m.destination);
        for (const a of addrs) {
          if (!a || visited.has(a)) continue;
          visited.add(a);
          try {
            const classified = await getInfoAndClassify(a);
            addToResult(result, classified, null, cocoonQueue);
          } catch {}
        }
      }
    } catch {}
  }

  // 4. BFS crawl from all discovered cocoon contracts
  let idx = 0;
  while (idx < cocoonQueue.length) {
    const { address: addr, type } = cocoonQueue[idx++];
    try {
      const txs = await getAllTxs(addr, 1);
      const entry = findEntry(result, addr);
      if (entry) entry.lastActivity = txs[0]?.utime || 0;

      result.transactions.push(...txs.map(tx => ({ ...tx, contractRole: type })));

      // Discover new addresses
      const newAddrs = new Set();
      for (const tx of txs) {
        if (tx.in_msg?.source && !visited.has(tx.in_msg.source)) newAddrs.add(tx.in_msg.source);
        for (const m of tx.out_msgs || []) {
          if (m.destination && !visited.has(m.destination)) newAddrs.add(m.destination);
        }
      }

      for (const a of newAddrs) {
        visited.add(a);
        try {
          const classified = await getInfoAndClassify(a);
          addToResult(result, classified, type === 'cocoon_proxy' ? addr : null, cocoonQueue);
        } catch {}
      }
    } catch (e) {
      console.warn(`[discover] crawl fail ${addr.slice(0, 20)}:`, e.message);
    }
  }

  // Dedup txs
  const txMap = new Map();
  for (const tx of result.transactions) txMap.set(tx.transaction_id.lt + tx.transaction_id.hash, tx);
  result.transactions = [...txMap.values()].sort((a, b) => b.utime - a.utime);

  console.log(`[discover] done: ${result.proxies.length}P ${result.clients.length}C ${result.workers.length}W ${result.cocoonWallets.length}CW ${result.relatedWallets.length}RW`);
  return result;
}

function addToResult(result, classified, parentProxy, queue) {
  const { address, type } = classified;
  const entry = { ...classified, lastActivity: 0 };

  switch (type) {
    case 'cocoon_proxy':
      if (!result.proxies.find(p => p.address === address)) {
        entry.clients = [];
        entry.workers = [];
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
    case 'cocoon_root':
      break; // skip, already have root
    default:
      // Check if this is a wallet that interacts with cocoon via opcodes
      // (e.g. wallet_v5 that pays into proxy)
      // Keep as related wallet if it has payout/funding relationships
      if (parentProxy && type !== 'no_code') {
        if (!result.relatedWallets.find(w => w.address === address)) {
          entry.proxyAddress = parentProxy;
          result.relatedWallets.push(entry);
        }
      }
      break;
  }
}

function findEntry(result, addr) {
  return result.proxies.find(p => p.address === addr)
    || result.clients.find(c => c.address === addr)
    || result.workers.find(w => w.address === addr)
    || result.cocoonWallets.find(w => w.address === addr);
}

// --- Routes ---
function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
function error(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ error: msg }));
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/api/discover') {
      if (cache && Date.now() - cacheTime < CACHE_TTL) return json(res, cache);
      cache = await discover();
      cacheTime = Date.now();
      return json(res, cache);
    }

    const addrMatch = path.match(/^\/api\/address\/(.+)$/);
    if (addrMatch) {
      const addr = decodeURIComponent(addrMatch[1]);
      const info = unwrap(await tc.get('/getAddressInformation', { params: { address: addr } }));
      return json(res, info);
    }

    const txMatch = path.match(/^\/api\/transactions\/(.+)$/);
    if (txMatch) {
      const addr = decodeURIComponent(txMatch[1]);
      const limit = parseInt(url.searchParams.get('limit')) || 30;
      const data = unwrap(await tc.get('/getTransactions', { params: { address: addr, limit } }));
      return json(res, data);
    }

    const typeMatch = path.match(/^\/api\/account-type\/(.+)$/);
    if (typeMatch) {
      const addr = decodeURIComponent(typeMatch[1]);
      const info = unwrap(await tc.get('/getAddressInformation', { params: { address: addr } }));
      const type = classifyByCode(info.code);
      const codeHash = getCodeHash(info.code);

      // Also scan txs for opcodes
      let txs = [];
      try { txs = unwrap(await tc.get('/getTransactions', { params: { address: addr, limit: 10 } })); } catch {}
      const ops = new Set();
      for (const tx of txs) {
        const o1 = extractOp(tx.in_msg?.msg_data?.body); if (o1) ops.add(o1);
        for (const m of tx.out_msgs || []) { const o2 = extractOp(m.msg_data?.body); if (o2) ops.add(o2); }
      }

      return json(res, {
        interfaces: type.startsWith('cocoon_') ? [type] : [],
        type,
        codeHash,
        is_wallet: type === 'unknown' && (!info.code || info.code.length < 1200),
        balance: info.balance,
        status: info.state,
        opcodes: [...ops],
      });
    }

    error(res, 404, 'Not found');
  } catch (e) {
    console.error('[error]', path, e.message);
    error(res, 500, e.message);
  }
}).listen(PORT, () => console.log(`Cocoon API :${PORT}`));
