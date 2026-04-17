// Contract classification by code hash — Web Crypto API (no Node crypto)

const CODE_TYPES = {
  'cfd7fb56c93c4e68': 'cocoon_root',
  '4693d2a95d0e55d4': 'cocoon_proxy',
  '5598b6810bed2266': 'cocoon_proxy',
  '3204b6ab0ec40172': 'cocoon_client',
  '81b712e7d26313be': 'cocoon_client',
  '32f26bd974265be9': 'cocoon_client',
  '8641e3b7669e0366': 'cocoon_worker',
  '2051342c307e220a': 'cocoon_wallet',
  '9bd714dcc1ff9058': 'cocoon_wallet',
  // '51d730a6efdfe50c' is Telegram's wallet_highload_v3r1 — NOT a Cocoon wallet
  // (removed after user report; previously mis-classified 778 public wallets as cocoon_wallets)
};

function b64ToBytes(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function getCodeHash(codeBase64) {
  if (!codeBase64) return null;
  const bytes = b64ToBytes(codeBase64);
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  const hashArr = new Uint8Array(hashBuf);
  let hex = '';
  for (const b of hashArr) hex += b.toString(16).padStart(2, '0');
  return hex.slice(0, 16);
}

export async function classifyByCode(codeBase64) {
  const hash = await getCodeHash(codeBase64);
  if (!hash) return 'no_code';
  return CODE_TYPES[hash] || 'unknown';
}
