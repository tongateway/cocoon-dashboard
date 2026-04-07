// TON address format conversion — pure JS, no @ton/core
// Addresses: 1 byte flags + 1 byte workchain + 32 bytes hash + 2 bytes CRC16

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BASE64STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64ToBytes(str) {
  // Normalize to standard base64
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function crc16(data) {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

// Parse any TON address format → { workchain, hash }
export function parseAddress(addr) {
  if (!addr) return null;

  // Raw format: "workchain:hex"
  if (addr.includes(':')) {
    const [wc, hex] = addr.split(':');
    const hash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) hash[i] = parseInt(hex.substr(i * 2, 2), 16);
    return { workchain: parseInt(wc), hash };
  }

  // Friendly format (EQ/UQ/kQ etc)
  try {
    const bytes = b64ToBytes(addr);
    if (bytes.length !== 36) return null;
    const flags = bytes[0];
    const workchain = bytes[1] === 0xff ? -1 : bytes[1];
    const hash = bytes.slice(2, 34);
    return { workchain, hash, bounceable: (flags & 0x11) === 0x11 };
  } catch {
    return null;
  }
}

// Convert to friendly format
function toFriendly(workchain, hash, bounceable) {
  const flags = bounceable ? 0x11 : 0x51;
  const addr = new Uint8Array(36);
  addr[0] = flags;
  addr[1] = workchain === -1 ? 0xff : workchain;
  addr.set(hash, 2);
  const crc = crc16(addr.slice(0, 34));
  addr[34] = (crc >> 8) & 0xff;
  addr[35] = crc & 0xff;
  return bytesToB64Url(addr);
}

export function toUQ(addr) {
  const parsed = parseAddress(addr);
  if (!parsed) return addr;
  return toFriendly(parsed.workchain, parsed.hash, false);
}

export function toEQ(addr) {
  const parsed = parseAddress(addr);
  if (!parsed) return addr;
  return toFriendly(parsed.workchain, parsed.hash, true);
}

// Recursively convert addresses in objects to UQ format
export function convertAddresses(obj) {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (/^(EQ|UQ|kQ|0:)[A-Za-z0-9_\-+/]{44,}/.test(obj)) return toUQ(obj);
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(convertAddresses);
  if (typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) result[k] = convertAddresses(v);
    return result;
  }
  return obj;
}
