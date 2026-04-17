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
