// Returns nanoTON (integer). Callers divide by 1e9 for TON.

function opName(tx) {
  if (tx._op) return tx._op; // test fixture shortcut
  // Real txs: opcode pre-parsed into tx._opName by useLiveFeed; fallback = null
  return tx._opName || null;
}

export function computeSpend(txs) {
  let total = 0;
  for (const tx of txs) {
    const role = tx.contractRole;
    const op = opName(tx);
    const inVal = parseInt(tx.in_msg?.value || '0', 10);
    if (role === 'cocoon_proxy' && op === 'client_proxy_request' && inVal > 0) total += inVal;
    if (role === 'cocoon_client' && op === 'ext_client_charge_signed' && inVal > 0) total += inVal;
  }
  return total;
}

export function workerRevenue(txs) {
  let total = 0;
  for (const tx of txs) {
    const inVal = parseInt(tx.in_msg?.value || '0', 10);
    if (tx.contractRole === 'cocoon_worker' && opName(tx) === 'ext_worker_payout_signed' && inVal > 0) {
      total += inVal;
    }
  }
  return total;
}

export function commission(txs) {
  return Math.max(0, computeSpend(txs) - workerRevenue(txs));
}

export function tokensProcessed(txs, pricePerToken = 20) {
  if (!pricePerToken || pricePerToken <= 0) return 0;
  return Math.round(computeSpend(txs) / pricePerToken);
}

// utime is seconds (toncenter format). nowMs is ms (Date.now()).
export function inWindow(txs, windowMs, nowMs = Date.now()) {
  const minUtime = (nowMs - windowMs) / 1000;
  return txs.filter(t => (t.utime ?? 0) >= minUtime);
}

export function activeWorkers(txs) {
  const set = new Set();
  for (const tx of txs) {
    if (tx.contractRole !== 'cocoon_worker') continue;
    if (opName(tx) !== 'ext_worker_payout_signed') continue;
    const addr = tx.address?.account_address;
    if (addr) set.add(addr);
  }
  return set.size;
}

// Counts unique CLIENT CONTRACT addresses that were charged for inference.
// Uses only the client-contract perspective (ext_client_charge_signed on cocoon_client),
// so the denominator "N / graph.clients.size" compares like-for-like (contracts to contracts).
export function activeClients(txs) {
  const set = new Set();
  for (const tx of txs) {
    if (tx.contractRole !== 'cocoon_client') continue;
    if (opName(tx) !== 'ext_client_charge_signed') continue;
    const addr = tx.address?.account_address;
    if (addr) set.add(addr);
  }
  return set.size;
}

/**
 * Classify overall network state from the tx buffer.
 * Returns: { status, label, color, lastTxAgoSec, last1hCount, last24hCount, lastOlderActivityAgoSec }
 * status: 'healthy' | 'quiet' | 'stalled' | 'dormant'
 * "Last older activity" = most recent tx that is older than 24 hours — i.e., the tail of the previous active period.
 */
export function networkHealth(txs, nowMs = Date.now()) {
  const now = nowMs / 1000;
  let last5minCount = 0, last1hCount = 0, last24hCount = 0;
  let lastTx = 0, lastOlder = 0;
  for (const t of txs) {
    const age = now - (t.utime ?? 0);
    if (age < 0) continue;
    if (age < 300) last5minCount++;
    if (age < 3600) last1hCount++;
    if (age < 86400) last24hCount++;
    if ((t.utime ?? 0) > lastTx) lastTx = t.utime;
    if (age >= 86400 && (t.utime ?? 0) > lastOlder) lastOlder = t.utime;
  }

  let status, label, color;
  if (last5minCount > 0 && last1hCount >= 10) {
    status = 'healthy'; label = 'Healthy'; color = '#3fb950';
  } else if (last1hCount > 0) {
    status = 'quiet'; label = 'Quiet'; color = '#d29922';
  } else if (last24hCount > 0) {
    status = 'stalled'; label = 'Stalled'; color = '#f0883e';
  } else {
    status = 'dormant'; label = 'Dormant'; color = '#f85149';
  }

  return {
    status, label, color,
    lastTxAgoSec: lastTx ? Math.max(0, Math.floor(now - lastTx)) : null,
    last1hCount,
    last24hCount,
    lastOlderActivityAgoSec: lastOlder ? Math.max(0, Math.floor(now - lastOlder)) : null,
  };
}
