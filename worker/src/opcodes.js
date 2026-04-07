// Cocoon opcode extraction — same as frontend but for Worker

const OP = {
  0x2565934c:'excesses',0xc59a7cd3:'payout',0x9a1247c0:'do_not_process',
  0xe34b1c60:'root_add_worker_type',0x8d94a79a:'root_del_worker_type',
  0x71860e80:'root_add_proxy_type',0x3c41d0b2:'root_del_proxy_type',
  0x927c7cb5:'root_register_proxy',0x6d49eaf2:'root_unregister_proxy',
  0x9c7924ba:'root_update_proxy',0xc52ed8d4:'root_change_price',
  0xa2370f61:'root_upgrade_contracts',0x11aefd51:'root_upgrade',
  0x563c1d96:'root_reset',0x4f7c5789:'root_upgrade_full',
  0x4d725d2c:'worker_proxy_request',0x08e7d036:'worker_proxy_payout',
  0xa040ad28:'ext_worker_payout_signed',0xf5f26a36:'ext_worker_last_payout',
  0x26ed7f65:'owner_worker_register',
  0x65448ff4:'client_proxy_request',0x5cfc6b87:'client_proxy_top_up',
  0xa35cb580:'client_proxy_register',0xc68ebc7b:'client_proxy_refund',
  0xf4c354c9:'client_proxy_refund_force',
  0xf172e6c2:'ext_client_top_up',0xbb63ff93:'ext_client_charge_signed',
  0xefd711e1:'ext_client_refund_signed',
  0x29111ceb:'owner_client_reopen',0xc45f9f3b:'owner_client_register',
  0xa9357034:'owner_client_change_secret',0x8473b408:'owner_client_secret_topup',
  0xfafa6cc1:'owner_client_refund',0x6a1f6a60:'owner_client_increase_stake',
  0xda068e78:'owner_client_withdraw',
  0x9713f187:'ext_proxy_increase_stake',0x7610e6eb:'ext_proxy_payout',
  0xb51d5a01:'owner_proxy_close',0x636a4391:'ext_proxy_close_signed',
  0xe511abc7:'ext_proxy_close_complete',0x53109c0f:'proxy_save_state',
  0x9c69f376:'owner_wallet_send',
};

function b64ToBytes(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function extractOp(b64) {
  if (!b64) return null;
  try {
    const raw = b64ToBytes(b64);
    for (let o = 4; o < Math.min(20, raw.length - 3); o++) {
      const op = (raw[o] << 24 | raw[o+1] << 16 | raw[o+2] << 8 | raw[o+3]) >>> 0;
      if (OP[op]) return OP[op];
    }
  } catch {}
  return null;
}

export function scanOpcodes(txs, exclude) {
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
