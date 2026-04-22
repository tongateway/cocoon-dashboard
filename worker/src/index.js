// Cocoon Dashboard — Cloudflare Worker
// Handles API routes + cron-triggered discovery

import { ToncenterClient } from './toncenter.js';
import { runDiscovery } from './discovery.js';
import { analyzeAddress } from './analysis.js';
import { classifyByCode, getCodeHash } from './codehash.js';
import { extractOp } from './opcodes.js';
import { toEQ, toUQ, convertAddresses } from './address.js';

const CACHE_TTL = 120; // seconds
const ROOT_CONTRACT = 'EQCns7bYSp0igFvS1wpb5wsZjCKCV19MD5AVzI4EyxsnU73k';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(convertAddresses(data)), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': `max-age=${CACHE_TTL}` },
  });
}

function errorResponse(msg, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export default {
  // HTTP request handler
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' },
      });
    }

    // Only handle /api/* routes
    if (!path.startsWith('/api/')) return new Response(null, { status: 404 });

    const tc = new ToncenterClient(env.TONCENTER_API_KEY);
    const kv = env.COCOON_KV;

    try {
      // Discovery — serve from KV cache.
      // TTL matches the cron interval (300s) so a fresh cache is expected by
      // the next cron tick; if cron misses, an inline discovery refills with
      // the same TTL (no weird "drift" between inline and cron writes).
      if (path === '/api/discover') {
        const cached = await kv.get('discovery_cache', 'json');
        if (cached) return jsonResponse(cached);
        const result = await runDiscovery(tc, kv, ROOT_CONTRACT);
        await kv.put('discovery_cache', JSON.stringify(result), { expirationTtl: 300 });
        return jsonResponse(result);
      }

      // Known roots
      if (path === '/api/roots') {
        const roots = await kv.get('known_roots', 'json') || [{ address: ROOT_CONTRACT }];
        return jsonResponse({ roots });
      }

      // Address info
      const addrMatch = path.match(/^\/api\/address\/(.+)$/);
      if (addrMatch) {
        const addr = toEQ(decodeURIComponent(addrMatch[1]));
        return jsonResponse(await tc.getAddressInfo(addr));
      }

      // Transactions
      const txMatch = path.match(/^\/api\/transactions\/(.+)$/);
      if (txMatch) {
        const addr = toEQ(decodeURIComponent(txMatch[1]));
        const limit = parseInt(url.searchParams.get('limit')) || 30;
        return jsonResponse(await tc.getTransactions(addr, limit));
      }

      // Account type
      const typeMatch = path.match(/^\/api\/account-type\/(.+)$/);
      if (typeMatch) {
        const addr = toEQ(decodeURIComponent(typeMatch[1]));
        const info = await tc.getAddressInfo(addr);
        const type = await classifyByCode(info.code);
        let txs = [];
        try { txs = await tc.getTransactions(addr, 10); } catch {}
        const ops = new Set();
        for (const tx of txs) {
          const o1 = extractOp(tx.in_msg?.msg_data?.body); if (o1) ops.add(o1);
          for (const m of tx.out_msgs || []) { const o2 = extractOp(m.msg_data?.body); if (o2) ops.add(o2); }
        }
        return jsonResponse({
          interfaces: type.startsWith('cocoon_') ? [type] : [],
          type, codeHash: await getCodeHash(info.code),
          is_wallet: type === 'unknown' && (!info.code || info.code.length < 1200),
          balance: info.balance, status: info.state, opcodes: [...ops],
        });
      }

      // Deep analysis
      const analysisMatch = path.match(/^\/api\/analysis\/(.+)$/);
      if (analysisMatch) {
        const addr = toEQ(decodeURIComponent(analysisMatch[1]));
        return jsonResponse(await analyzeAddress(tc, addr));
      }

      return errorResponse('Not found', 404);
    } catch (e) {
      console.error('[error]', path, e.message);
      return errorResponse(e.message);
    }
  },

  // Cron trigger — runs discovery periodically
  async scheduled(event, env, ctx) {
    console.log('[cron] Discovery triggered');
    const tc = new ToncenterClient(env.TONCENTER_API_KEY);
    const kv = env.COCOON_KV;
    try {
      const result = await runDiscovery(tc, kv, ROOT_CONTRACT);
      await kv.put('discovery_cache', JSON.stringify(result), { expirationTtl: 300 });
      console.log(`[cron] Done: ${result.proxies.length}P ${result.clients.length}C ${result.workers.length}W`);
    } catch (e) {
      console.error('[cron] Failed:', e.message);
    }
  },
};
