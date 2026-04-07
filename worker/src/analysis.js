// Address analysis for Cloudflare Worker

import { classifyByCode, getCodeHash } from './codehash.js';
import { extractOp } from './opcodes.js';

export async function analyzeAddress(tc, addr) {
  const info = await tc.getAddressInfo(addr);
  const type = await classifyByCode(info.code);

  // Get all transactions (up to 500)
  const allTxs = await tc.getAllTxs(addr, 10);

  let totalIn = 0, totalOut = 0, totalFees = 0;
  const opCounts = {};
  const peers = new Map();

  for (const tx of allTxs) {
    const inVal = parseInt(tx.in_msg?.value || '0');
    const fee = parseInt(tx.fee || '0');
    totalIn += inVal;
    totalFees += fee;

    const inOp = extractOp(tx.in_msg?.msg_data?.body);
    if (inOp) opCounts[inOp] = (opCounts[inOp] || 0) + 1;

    const src = tx.in_msg?.source;
    if (src) {
      if (!peers.has(src)) peers.set(src, { inFlow: 0, outFlow: 0 });
      peers.get(src).inFlow += inVal;
    }

    for (const m of tx.out_msgs || []) {
      const outVal = parseInt(m.value || '0');
      totalOut += outVal;
      const outOp = extractOp(m.msg_data?.body);
      if (outOp) opCounts[outOp] = (opCounts[outOp] || 0) + 1;
      if (m.destination) {
        if (!peers.has(m.destination)) peers.set(m.destination, { inFlow: 0, outFlow: 0 });
        peers.get(m.destination).outFlow += outVal;
      }
    }
  }

  // Classify top peers
  const connections = [];
  const topPeers = [...peers.entries()].sort((a, b) => (b[1].inFlow + b[1].outFlow) - (a[1].inFlow + a[1].outFlow)).slice(0, 15);
  for (const [pAddr, flows] of topPeers) {
    try {
      const pInfo = await tc.getAddressInfo(pAddr);
      const pType = await classifyByCode(pInfo.code);
      connections.push({
        address: pAddr,
        type: pType.startsWith('cocoon_') ? pType : (pInfo.code?.length < 1000 ? 'wallet' : 'unknown'),
        balance: pInfo.balance,
        tonReceived: flows.inFlow,
        tonSent: flows.outFlow,
      });
    } catch {
      connections.push({ address: pAddr, type: 'unknown', balance: '0', tonReceived: flows.inFlow, tonSent: flows.outFlow });
    }
  }

  const computeSpend = totalOut;
  const tokenEstimates = {
    pricePerToken: 20,
    prompt: { multiplier: 1, priceNano: 20, tokens: Math.round(computeSpend / 20) },
    completion: { multiplier: 8, priceNano: 160, tokens: Math.round(computeSpend / 160) },
    reasoning: { multiplier: 8, priceNano: 160, tokens: Math.round(computeSpend / 160) },
    cached: { multiplier: 0.1, priceNano: 2, tokens: Math.round(computeSpend / 2) },
    estimatedMix: Math.round(computeSpend / 60),
  };

  const firstTx = allTxs.length > 0 ? allTxs[allTxs.length - 1].utime : 0;
  const lastTx = allTxs.length > 0 ? allTxs[0].utime : 0;

  return {
    address: addr, type, codeHash: await getCodeHash(info.code),
    balance: info.balance, state: info.state, totalTransactions: allTxs.length,
    financials: { totalReceived: totalIn, totalSent: totalOut, totalFees, computeSpend: totalOut },
    tokenEstimates, operations: Object.entries(opCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    connections,
    activity: { firstTx, lastTx, durationDays: firstTx && lastTx ? Math.max(1, Math.round((lastTx - firstTx) / 86400)) : 0 },
  };
}
