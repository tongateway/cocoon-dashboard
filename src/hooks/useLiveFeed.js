import { useEffect, useRef, useState } from 'react';
import { Buffer } from 'buffer';
import { sseUrl, fetchTransactionByHash } from '../api/tonapi';
import { parseTxOpcode } from '../lib/opcodes';

// Exported for tests — do not import into components directly.
export function __makeBuffer(capacity) {
  const order = [];     // newest first
  const byId = new Map();

  return {
    push(tx) {
      const id = tx.id || `${tx.utime}-${tx.in_msg?.source || ''}-${tx.in_msg?.value || ''}`;
      if (byId.has(id)) return;
      order.unshift({ ...tx, id });
      byId.set(id, true);
      while (order.length > capacity) {
        const removed = order.pop();
        byId.delete(removed.id);
      }
    },
    items() { return order.slice(); },
    txsInWindow(windowMs, nowMs = Date.now()) {
      const minUtime = (nowMs - windowMs) / 1000;
      return order.filter(t => (t.utime ?? 0) >= minUtime);
    },
    size() { return order.length; },
  };
}

const BUFFER_CAP = 2000;
const RECONNECT_BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];

/**
 * Opens an SSE stream to tonapi for the given accounts and keeps a rolling buffer.
 * `seed` is an array of txs to prime the buffer on mount (from worker cache).
 * `accounts` is a string array; re-subscribes when it changes.
 * `onFallback` fires when SSE has failed repeatedly so the parent can start polling.
 */
export function useLiveFeed({ accounts, seed = [], onFallback }) {
  const bufferRef = useRef(__makeBuffer(BUFFER_CAP));
  const [version, setVersion] = useState(0); // bumps on every buffer change
  const [connected, setConnected] = useState(false);

  // Seed the buffer once on mount (or when seed array identity changes)
  useEffect(() => {
    for (const tx of seed) bufferRef.current.push(tx);
    setVersion(v => v + 1);
  }, [seed]);

  useEffect(() => {
    if (!accounts || accounts.length === 0) return;

    let es;
    let attempt = 0;
    let cancelled = false;
    let failTimer;

    const connect = () => {
      if (cancelled) return;
      const url = sseUrl(accounts);
      es = new EventSource(url);

      es.addEventListener('message', async (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          const hash = payload.tx_hash;
          if (!hash) return;
          const tx = await fetchTransactionByHash(hash);
          // Normalize shape to match toncenter format used elsewhere
          const normalized = normalizeTonapiTx(tx, payload.account_id);
          bufferRef.current.push(normalized);
          setVersion(v => v + 1);
          setConnected(true);
          attempt = 0;
        } catch (err) {
          console.error('[sse] tx fetch failed', err);
        }
      });

      es.addEventListener('error', () => {
        es.close();
        setConnected(false);
        attempt += 1;
        if (attempt >= 3 && onFallback) onFallback();
        const delay = RECONNECT_BACKOFF[Math.min(attempt, RECONNECT_BACKOFF.length - 1)];
        failTimer = setTimeout(connect, delay);
      });
    };

    connect();
    return () => {
      cancelled = true;
      if (es) es.close();
      if (failTimer) clearTimeout(failTimer);
    };
  }, [accounts.join(','), onFallback]);

  return {
    buffer: bufferRef.current,
    version,
    connected,
  };
}

function normalizeTonapiTx(tonapiTx, accountId) {
  // Map tonapi's transaction shape to the toncenter shape used by rateMath/txClassify.
  const inMsgHex = tonapiTx.in_msg?.raw_body;
  const inMsgBase64 = inMsgHex ? Buffer.from(inMsgHex, 'hex').toString('base64') : '';
  const opInfo = parseTxOpcode({
    in_msg: { msg_data: { body: inMsgBase64 } },
    out_msgs: (tonapiTx.out_msgs || []).map(m => ({ msg_data: { body: m.raw_body ? Buffer.from(m.raw_body, 'hex').toString('base64') : '' } })),
  });
  return {
    utime: tonapiTx.utime,
    transaction_id: { lt: tonapiTx.lt, hash: tonapiTx.hash },
    fee: String(tonapiTx.total_fees || 0),
    address: { account_address: accountId },
    in_msg: {
      source: tonapiTx.in_msg?.source?.address || '',
      value: String(tonapiTx.in_msg?.value || 0),
      msg_data: { body: inMsgBase64 },
    },
    out_msgs: (tonapiTx.out_msgs || []).map(m => ({
      destination: m.destination?.address || '',
      value: String(m.value || 0),
      msg_data: { body: m.raw_body ? Buffer.from(m.raw_body, 'hex').toString('base64') : '' },
    })),
    _op: opInfo?.name || null,
    contractRole: null, // filled in by useNetworkData using graph lookup
  };
}
