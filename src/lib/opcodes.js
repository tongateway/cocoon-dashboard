// Cocoon Network smart contract opcodes
// Source: TelegramMessenger/cocoon/runners/smartcontracts/Opcodes.hpp

export const COCOON_OPCODES = {
  0x2565934c: { name: 'excesses', desc: 'Excess TON returned', category: 'system' },
  0xc59a7cd3: { name: 'payout', desc: 'Payout withdrawal', category: 'payment' },
  0x9a1247c0: { name: 'do_not_process', desc: 'Do not process marker', category: 'system' },

  // Root contract operations
  0xe34b1c60: { name: 'root_add_worker_type', desc: 'Add worker image hash', category: 'root' },
  0x8d94a79a: { name: 'root_del_worker_type', desc: 'Remove worker image hash', category: 'root' },
  0x71860e80: { name: 'root_add_proxy_type', desc: 'Add proxy image hash', category: 'root' },
  0x3c41d0b2: { name: 'root_del_proxy_type', desc: 'Remove proxy image hash', category: 'root' },
  0x927c7cb5: { name: 'root_register_proxy', desc: 'Register new proxy', category: 'root' },
  0x6d49eaf2: { name: 'root_unregister_proxy', desc: 'Unregister proxy', category: 'root' },
  0x9c7924ba: { name: 'root_update_proxy', desc: 'Update proxy config', category: 'root' },
  0xc52ed8d4: { name: 'root_change_price', desc: 'Change price per token', category: 'root' },
  0xa2370f61: { name: 'root_upgrade_contracts', desc: 'Upgrade contract code', category: 'root' },
  0x11aefd51: { name: 'root_upgrade', desc: 'Upgrade root contract', category: 'root' },
  0x563c1d96: { name: 'root_reset', desc: 'Reset root contract', category: 'root' },
  0x4f7c5789: { name: 'root_upgrade_full', desc: 'Full root upgrade', category: 'root' },

  // Worker operations
  0x4d725d2c: { name: 'worker_proxy_request', desc: 'Worker payment from proxy', category: 'worker' },
  0x08e7d036: { name: 'worker_proxy_payout', desc: 'Worker payout from proxy', category: 'worker' },
  0xa040ad28: { name: 'ext_worker_payout_signed', desc: 'Worker signed payout', category: 'worker' },
  0xf5f26a36: { name: 'ext_worker_last_payout', desc: 'Worker last payout', category: 'worker' },
  0x26ed7f65: { name: 'owner_worker_register', desc: 'Register worker', category: 'worker' },

  // Client operations
  0x65448ff4: { name: 'client_proxy_request', desc: 'Client charge by proxy', category: 'client' },
  0x5cfc6b87: { name: 'client_proxy_top_up', desc: 'Client top-up via proxy', category: 'client' },
  0xa35cb580: { name: 'client_proxy_register', desc: 'Client registered by proxy', category: 'client' },
  0xc68ebc7b: { name: 'client_proxy_refund', desc: 'Client refund granted', category: 'client' },
  0xf4c354c9: { name: 'client_proxy_refund_force', desc: 'Client forced refund', category: 'client' },
  0xf172e6c2: { name: 'ext_client_top_up', desc: 'Client top-up', category: 'client' },
  0xbb63ff93: { name: 'ext_client_charge_signed', desc: 'Client signed charge', category: 'client' },
  0xefd711e1: { name: 'ext_client_refund_signed', desc: 'Client signed refund', category: 'client' },
  0x29111ceb: { name: 'owner_client_reopen', desc: 'Client top-up & reopen', category: 'client' },
  0xc45f9f3b: { name: 'owner_client_register', desc: 'Register client', category: 'client' },
  0xa9357034: { name: 'owner_client_change_secret', desc: 'Change client secret', category: 'client' },
  0x8473b408: { name: 'owner_client_secret_topup', desc: 'Change secret + top-up', category: 'client' },
  0xfafa6cc1: { name: 'owner_client_refund', desc: 'Request client refund', category: 'client' },
  0x6a1f6a60: { name: 'owner_client_increase_stake', desc: 'Increase client stake', category: 'client' },
  0xda068e78: { name: 'owner_client_withdraw', desc: 'Withdraw from client', category: 'client' },

  // Proxy operations
  0x9713f187: { name: 'ext_proxy_increase_stake', desc: 'Increase proxy stake', category: 'proxy' },
  0x7610e6eb: { name: 'ext_proxy_payout', desc: 'Proxy payout request', category: 'proxy' },
  0xb51d5a01: { name: 'owner_proxy_close', desc: 'Close proxy', category: 'proxy' },
  0x636a4391: { name: 'ext_proxy_close_signed', desc: 'Proxy signed close', category: 'proxy' },
  0xe511abc7: { name: 'ext_proxy_close_complete', desc: 'Proxy close complete', category: 'proxy' },
  0x53109c0f: { name: 'proxy_save_state', desc: 'Proxy save state to chain', category: 'proxy' },

  // Wallet operations
  0x9c69f376: { name: 'owner_wallet_send', desc: 'Wallet send message', category: 'wallet' },
};

const CATEGORY_COLORS = {
  root: 'yellow',
  proxy: 'purple',
  client: 'cyan',
  worker: 'orange',
  payment: 'green',
  wallet: 'teal',
  system: 'gray',
};

/**
 * Try to extract opcode from a BOC body (base64 encoded).
 * Returns { opcode, name, desc, category, color } or null.
 */
export function parseOpcode(bodyBase64) {
  if (!bodyBase64) return null;
  try {
    const raw = atob(bodyBase64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    // Try to find opcode at various offsets in the BOC
    for (let offset = 4; offset < Math.min(20, bytes.length - 3); offset++) {
      const op = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
      const info = COCOON_OPCODES[op >>> 0];
      if (info) {
        return {
          opcode: '0x' + (op >>> 0).toString(16).padStart(8, '0'),
          ...info,
          color: CATEGORY_COLORS[info.category] || 'gray',
        };
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/**
 * Parse opcode from a transaction's messages.
 * Checks in_msg and out_msgs, returns first match.
 */
export function parseTxOpcode(tx) {
  // Check incoming message body
  const inBody = tx.in_msg?.msg_data?.body;
  const inOp = parseOpcode(inBody);
  if (inOp) return inOp;

  // Check outgoing messages
  for (const m of tx.out_msgs || []) {
    const outBody = m.msg_data?.body;
    const outOp = parseOpcode(outBody);
    if (outOp) return outOp;
  }

  return null;
}

/**
 * Compute spend stats for a cocoon_wallet from its transactions.
 */
export function computeWalletSpend(transactions) {
  let totalReceived = 0;
  let totalSent = 0;
  let totalFees = 0;
  const opCounts = {};

  for (const tx of transactions) {
    const inVal = parseInt(tx.in_msg?.value || '0');
    const fee = parseInt(tx.fee || '0');
    totalReceived += inVal;
    totalFees += fee;

    for (const m of tx.out_msgs || []) {
      totalSent += parseInt(m.value || '0');
    }

    const op = parseTxOpcode(tx);
    if (op) {
      opCounts[op.name] = (opCounts[op.name] || 0) + 1;
    }
  }

  return {
    totalReceived: totalReceived / 1e9,
    totalSent: totalSent / 1e9,
    totalFees: totalFees / 1e9,
    computeSpend: totalSent / 1e9,
    remaining: (totalReceived - totalSent - totalFees * 1e9) / 1e9,
    opCounts,
  };
}
