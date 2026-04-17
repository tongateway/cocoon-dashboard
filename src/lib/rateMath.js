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

export function activeClients(txs) {
  const set = new Set();
  for (const tx of txs) {
    const op = opName(tx);
    if (tx.contractRole === 'cocoon_proxy' && op === 'client_proxy_request') {
      const src = tx.in_msg?.source;
      if (src) set.add(src);
    } else if (tx.contractRole === 'cocoon_client' && op === 'ext_client_charge_signed') {
      const addr = tx.address?.account_address;
      if (addr) set.add(addr);
    }
  }
  return set.size;
}
