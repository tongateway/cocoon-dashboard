export const TX_TYPE = {
  WORKER_PAYOUT: 'worker_payout',
  CLIENT_CHARGE: 'client_charge',
  TOP_UP: 'top_up',
  PROXY_FEE: 'proxy_fee',
  OTHER: 'other',
};

export function classifyTx(tx) {
  const op = tx._op || tx._opName;
  const role = tx.contractRole;
  if (role === 'cocoon_worker' && op === 'ext_worker_payout_signed') return TX_TYPE.WORKER_PAYOUT;
  if (role === 'cocoon_proxy' && op === 'client_proxy_request') return TX_TYPE.CLIENT_CHARGE;
  if (role === 'cocoon_client' && op === 'ext_client_charge_signed') return TX_TYPE.CLIENT_CHARGE;
  if (op === 'client_proxy_top_up' || op === 'ext_client_top_up') return TX_TYPE.TOP_UP;
  if (role === 'cocoon_proxy' && (op === 'ext_proxy_payout' || op === 'proxy_save_state')) return TX_TYPE.PROXY_FEE;
  return TX_TYPE.OTHER;
}

export const TX_TYPE_LABEL = {
  [TX_TYPE.WORKER_PAYOUT]: { label: 'Worker payout', color: '#3fb950', bg: 'rgba(63,185,80,0.15)' },
  [TX_TYPE.CLIENT_CHARGE]: { label: 'Client charge', color: '#58a6ff', bg: 'rgba(88,166,255,0.15)' },
  [TX_TYPE.TOP_UP]:        { label: 'Top-up',        color: '#d29922', bg: 'rgba(210,153,34,0.15)' },
  [TX_TYPE.PROXY_FEE]:     { label: 'Proxy fee',     color: '#8b949e', bg: 'rgba(139,148,158,0.15)' },
  [TX_TYPE.OTHER]:         { label: 'Other',         color: '#8b949e', bg: 'rgba(139,148,158,0.10)' },
};
