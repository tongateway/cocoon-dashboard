import 'dotenv/config';
import { createServer } from 'http';
import axios from 'axios';

const { TONCENTER_API_KEY, ROOT_CONTRACT, PORT = 3001 } = process.env;

const tc = axios.create({
  baseURL: 'https://toncenter.com/api/v2',
  headers: { 'X-API-Key': TONCENTER_API_KEY },
  timeout: 10_000,
});

function unwrap(r) {
  if (!r.data.ok) throw new Error(r.data.error || 'toncenter error');
  return r.data.result;
}

// Opcodes
const OP = {0x2565934c:'excesses',0xc59a7cd3:'payout',0xc45f9f3b:'owner_client_register',0x65448ff4:'client_proxy_request',0x5cfc6b87:'client_proxy_top_up',0xa35cb580:'client_proxy_register',0x4d725d2c:'worker_proxy_request',0x08e7d036:'worker_proxy_payout',0x927c7cb5:'root_register_proxy',0x9c7924ba:'root_update_proxy',0xf172e6c2:'ext_client_top_up',0xbb63ff93:'ext_client_charge_signed',0xa9357034:'owner_client_change_secret',0x9c69f376:'owner_wallet_send',0xa040ad28:'ext_worker_payout_signed',0x26ed7f65:'owner_worker_register',0x53109c0f:'proxy_save_state',0x9713f187:'ext_proxy_increase_stake',0x7610e6eb:'ext_proxy_payout',0xb51d5a01:'owner_proxy_close',0x636a4391:'ext_proxy_close_signed',0xc52ed8d4:'root_change_price',0xa2370f61:'root_upgrade_contracts',0xc68ebc7b:'client_proxy_refund',0xda068e78:'owner_client_withdraw',0x6a1f6a60:'owner_client_increase_stake',0xfafa6cc1:'owner_client_refund',0x8473b408:'owner_client_secret_topup'};

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

function scanOpcodes(txs, exclude) {
  const found = new Map();
  for (const tx of txs) {
    const check = (a, op) => {
      if (!a || !op || exclude.has(a) || op === 'excesses' || op === 'payout') return;
      if (!found.has(a)) found.set(a, new Set());
      found.get(a).add(op);
    };
    check(tx.in_msg?.source, extractOp(tx.in_msg?.msg_data?.body));
    for (const m of tx.out_msgs || []) check(m.destination, extractOp(m.msg_data?.body));
  }
  return found;
}

// Cache
let cache = null;
let cacheTime = 0;

async function discover() {
  console.log('[discover] start');
  const result = { root: {}, proxies: [], clients: [], workers: [], cocoonWallets: [], transactions: [] };

  const [rootInfo, rootTxs] = await Promise.all([
    unwrap(await tc.get('/getAddressInformation', { params: { address: ROOT_CONTRACT } })),
    unwrap(await tc.get('/getTransactions', { params: { address: ROOT_CONTRACT, limit: 50 } })),
  ]);
  result.root = { address: ROOT_CONTRACT, balance: rootInfo.balance, state: rootInfo.state, lastActivity: rootTxs[0]?.utime || 0 };
  result.transactions.push(...rootTxs.map(tx => ({ ...tx, contractRole: 'root' })));

  const exclude = new Set([ROOT_CONTRACT, '']);
  const cocoon = scanOpcodes(rootTxs, exclude);
  console.log(`[discover] ${cocoon.size} cocoon addrs from root`);

  for (const [addr, ops] of cocoon) {
    exclude.add(addr);
    try {
      const info = unwrap(await tc.get('/getAddressInformation', { params: { address: addr } }));
      const isProxy = ops.has('owner_client_register') || ops.has('root_register_proxy');
      const entry = { address: addr, type: isProxy ? 'proxy' : 'cocoon_wallet', balance: info.balance, state: info.state, opcodes: [...ops], clients: [], workers: [], lastActivity: 0 };
      if (isProxy) result.proxies.push(entry);
      else result.cocoonWallets.push(entry);
    } catch {}
  }

  // Crawl proxies
  for (const proxy of result.proxies) {
    try {
      const txs = unwrap(await tc.get('/getTransactions', { params: { address: proxy.address, limit: 30 } }));
      proxy.lastActivity = txs[0]?.utime || 0;
      result.transactions.push(...txs.map(tx => ({ ...tx, contractRole: 'proxy' })));

      const children = scanOpcodes(txs, exclude);
      for (const [addr, ops] of children) {
        exclude.add(addr);
        try {
          const info = unwrap(await tc.get('/getAddressInformation', { params: { address: addr } }));
          const isClient = ops.has('client_proxy_request') || ops.has('client_proxy_register') || ops.has('ext_client_top_up');
          const isWorker = ops.has('worker_proxy_request') || ops.has('ext_worker_payout_signed');
          if (isClient) { result.clients.push({ address: addr, type: 'client', balance: info.balance, state: info.state, opcodes: [...ops], proxyAddress: proxy.address }); proxy.clients.push(addr); }
          else if (isWorker) { result.workers.push({ address: addr, type: 'worker', balance: info.balance, state: info.state, opcodes: [...ops], proxyAddress: proxy.address }); proxy.workers.push(addr); }
        } catch {}
      }
    } catch {}
  }

  // Dedup txs
  const txMap = new Map();
  for (const tx of result.transactions) txMap.set(tx.transaction_id.lt + tx.transaction_id.hash, tx);
  result.transactions = [...txMap.values()].sort((a, b) => b.utime - a.utime);

  console.log(`[discover] done: ${result.proxies.length}P ${result.clients.length}C ${result.workers.length}W`);
  return result;
}

// Router
function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function error(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ error: msg }));
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/api/discover') {
      if (cache && Date.now() - cacheTime < 120_000) return json(res, cache);
      cache = await discover();
      cacheTime = Date.now();
      return json(res, cache);
    }

    const addrMatch = path.match(/^\/api\/address\/(.+)$/);
    if (addrMatch) {
      const data = unwrap(await tc.get('/getAddressInformation', { params: { address: decodeURIComponent(addrMatch[1]) } }));
      return json(res, data);
    }

    const txMatch = path.match(/^\/api\/transactions\/(.+)$/);
    if (txMatch) {
      const limit = parseInt(url.searchParams.get('limit')) || 30;
      const data = unwrap(await tc.get('/getTransactions', { params: { address: decodeURIComponent(txMatch[1]), limit } }));
      return json(res, data);
    }

    const typeMatch = path.match(/^\/api\/account-type\/(.+)$/);
    if (typeMatch) {
      const addr = decodeURIComponent(typeMatch[1]);
      const [info, txs] = await Promise.all([
        unwrap(await tc.get('/getAddressInformation', { params: { address: addr } })),
        unwrap(await tc.get('/getTransactions', { params: { address: addr, limit: 10 } })),
      ]);
      const ops = new Set();
      for (const tx of txs) {
        const o1 = extractOp(tx.in_msg?.msg_data?.body); if (o1) ops.add(o1);
        for (const m of tx.out_msgs || []) { const o2 = extractOp(m.msg_data?.body); if (o2) ops.add(o2); }
      }
      let type = 'unknown';
      if (ops.has('owner_client_register') || ops.has('root_register_proxy')) type = 'cocoon_proxy';
      else if (ops.has('client_proxy_request')) type = 'cocoon_client';
      else if (ops.has('worker_proxy_request')) type = 'cocoon_worker';
      else if (ops.has('ext_client_top_up') || ops.has('owner_wallet_send') || ops.has('ext_client_charge_signed')) type = 'cocoon_wallet';
      return json(res, { interfaces: type !== 'unknown' ? [type] : [], is_wallet: !info.code || info.code.length < 300, balance: info.balance, status: info.state, opcodes: [...ops] });
    }

    error(res, 404, 'Not found');
  } catch (e) {
    console.error('[error]', path, e.message);
    error(res, 500, e.message);
  }
});

server.listen(PORT, () => console.log(`Cocoon API :${PORT}`));
