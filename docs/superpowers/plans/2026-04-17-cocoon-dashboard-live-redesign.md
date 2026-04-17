# Cocoon Dashboard Live Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Cocoon dashboard UI so viewers can instantly tell the network is alive and understand what every number means, powered by a hybrid data model (existing Cloudflare Worker snapshot + new tonapi SSE stream).

**Architecture:** Keep the worker's discovery crawl for the contract graph. Frontend opens an SSE subscription to tonapi.io for real-time transaction events on root + all discovered proxies. Rate math (compute spend, worker revenue, commission, tokens) moves to the client as pure functions over a rolling tx buffer, so window toggles (1h/24h/7d/all) re-aggregate instantly with no backend round-trip.

**Tech Stack:** React 19, Chakra UI v2, Vite, `@ton/core` (for `Address.parse` validation), vitest (new — for testing pure logic + hook). No new heavyweight deps; charts are raw SVG.

**Spec:** [docs/superpowers/specs/2026-04-17-cocoon-dashboard-live-redesign.md](../specs/2026-04-17-cocoon-dashboard-live-redesign.md)

---

## File Structure

**Create:**
- `src/lib/rateMath.js` — pure aggregation functions over tx arrays
- `src/lib/rateMath.test.js` — vitest unit tests
- `src/lib/txClassify.js` — classify a tx as `charge | payout | topup | fee | deploy | other` using opcodes + contract role
- `src/lib/txClassify.test.js`
- `src/hooks/useLiveFeed.js` — SSE client + rolling tx buffer
- `src/hooks/useLiveFeed.test.js`
- `src/components/WindowToggle.jsx` — 1h/24h/7d/all pill toggle
- `src/components/LiveHero.jsx` — pulse header + 4 rate KPIs with sparklines
- `src/components/Sparkline.jsx` — raw-SVG tiny chart
- `src/components/TrendCharts.jsx` — stacked area + commission donut
- `src/components/ActorsPanel.jsx` — workers/clients active + event feed
- `src/components/AddressLookup.jsx` — search input + inline result card
- `src/components/ResultCard.jsx` — Cocoon verdict card (used by AddressLookup)
- `vitest.config.js` — test runner config

**Modify:**
- `src/hooks/useNetworkData.js` — expose `{graph, feed, isAlive, lastTxAgo, refresh}`; fold in `useLiveFeed`
- `src/App.jsx` — wire new components, lift `window` state
- `src/components/Header.jsx` — replace `SearchInput` with `AddressLookup`
- `src/components/TransactionFeed.jsx` — add opcode-classified type badge
- `src/api/tonapi.js` — add `sseUrl(accounts)` helper + `fetchTransaction(hash)`
- `package.json` — add vitest + jsdom + @testing-library/react dev deps; add `test` script
- `.env.example` — add `VITE_TONAPI_TOKEN` (optional)

**Delete:**
- `src/components/StatsCards.jsx`
- `src/components/TransactionChart.jsx`
- `src/components/SpendBreakdown.jsx`
- `src/components/TokenRevenueChart.jsx`
- `src/components/SearchInput.jsx`

---

## Task 1: Set up vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`

- [ ] **Step 1: Install dev deps**

```bash
npm install -D vitest@^2 @vitest/ui@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6
```

Expected: installs succeed.

- [ ] **Step 2: Add test script to `package.json`**

Edit the `scripts` block in `package.json` to add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
});
```

- [ ] **Step 4: Create `src/test-setup.js`**

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Sanity check — run vitest**

```bash
npm test
```

Expected: exits 0 with "No test files found" (no tests yet).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/test-setup.js
git commit -m "chore: add vitest + @testing-library/react for unit tests"
```

---

## Task 2: rateMath — compute spend

**Files:**
- Create: `src/lib/rateMath.js`
- Create: `src/lib/rateMath.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/rateMath.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeSpend } from './rateMath';

function tx({ role, opName, inValue = 0 }) {
  return {
    contractRole: role,
    in_msg: { value: String(inValue), msg_data: { body: '' } },
    out_msgs: [],
    _op: opName,
  };
}

describe('computeSpend', () => {
  it('returns 0 for empty array', () => {
    expect(computeSpend([])).toBe(0);
  });

  it('sums client_proxy_request in-values on proxy contracts (nanoTON)', () => {
    const txs = [
      tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 100_000_000 }),
      tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 200_000_000 }),
    ];
    expect(computeSpend(txs)).toBe(300_000_000);
  });

  it('sums ext_client_charge_signed in-values on client contracts', () => {
    const txs = [
      tx({ role: 'cocoon_client', opName: 'ext_client_charge_signed', inValue: 50_000_000 }),
    ];
    expect(computeSpend(txs)).toBe(50_000_000);
  });

  it('ignores txs with other ops or roles', () => {
    const txs = [
      tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 999 }),
      tx({ role: 'cocoon_proxy', opName: 'excesses', inValue: 999 }),
    ];
    expect(computeSpend(txs)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/rateMath.test.js
```

Expected: FAIL ("Cannot find module './rateMath'" or similar).

- [ ] **Step 3: Implement `computeSpend`**

Create `src/lib/rateMath.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/rateMath.test.js
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rateMath.js src/lib/rateMath.test.js
git commit -m "feat(rateMath): add computeSpend aggregation"
```

---

## Task 3: rateMath — worker revenue, commission, tokens

**Files:**
- Modify: `src/lib/rateMath.js`
- Modify: `src/lib/rateMath.test.js`

- [ ] **Step 1: Append failing tests to `rateMath.test.js`**

```js
import { computeSpend, workerRevenue, commission, tokensProcessed } from './rateMath';

describe('workerRevenue', () => {
  it('sums ext_worker_payout_signed on worker contracts', () => {
    const txs = [
      tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 400_000_000 }),
      tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 100_000_000 }),
      tx({ role: 'cocoon_client', opName: 'ext_worker_payout_signed', inValue: 999 }), // wrong role
    ];
    expect(workerRevenue(txs)).toBe(500_000_000);
  });
});

describe('commission', () => {
  it('is compute spend minus worker revenue', () => {
    const txs = [
      tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 1_000_000_000 }),
      tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 900_000_000 }),
    ];
    expect(commission(txs)).toBe(100_000_000);
  });

  it('clamps negative to 0', () => {
    const txs = [tx({ role: 'cocoon_worker', opName: 'ext_worker_payout_signed', inValue: 500 })];
    expect(commission(txs)).toBe(0);
  });
});

describe('tokensProcessed', () => {
  it('divides compute spend by pricePerToken', () => {
    const txs = [tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 2000 })];
    expect(tokensProcessed(txs, 20)).toBe(100); // 2000 / 20
  });

  it('uses default 20 nanoTON if pricePerToken missing', () => {
    const txs = [tx({ role: 'cocoon_proxy', opName: 'client_proxy_request', inValue: 200 })];
    expect(tokensProcessed(txs)).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
npm test -- src/lib/rateMath.test.js
```

Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement**

Append to `src/lib/rateMath.js`:

```js
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
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- src/lib/rateMath.test.js
```

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rateMath.js src/lib/rateMath.test.js
git commit -m "feat(rateMath): add workerRevenue, commission, tokensProcessed"
```

---

## Task 4: rateMath — active actors + time window filter

**Files:**
- Modify: `src/lib/rateMath.js`
- Modify: `src/lib/rateMath.test.js`

- [ ] **Step 1: Append failing tests**

```js
import { activeWorkers, activeClients, inWindow } from './rateMath';

describe('inWindow', () => {
  it('filters txs within N ms of now', () => {
    const now = 1_700_000_000;
    const txs = [
      { utime: now - 10 },       // 10s ago — include
      { utime: now - 3700 },     // 61min ago — exclude for 1h window
      { utime: now - 60 * 60 + 5 }, // 59m55s ago — include for 1h
    ];
    const r = inWindow(txs, 60 * 60 * 1000, now * 1000);
    expect(r.map(t => t.utime)).toEqual([now - 10, now - 60 * 60 + 5]);
  });
});

describe('activeWorkers', () => {
  it('counts unique worker addresses with ext_worker_payout_signed', () => {
    const txs = [
      { contractRole: 'cocoon_worker', _op: 'ext_worker_payout_signed',
        address: { account_address: 'EQA1' }, in_msg: { value: '100', msg_data: {} }, out_msgs: [] },
      { contractRole: 'cocoon_worker', _op: 'ext_worker_payout_signed',
        address: { account_address: 'EQA1' }, in_msg: { value: '200', msg_data: {} }, out_msgs: [] }, // dup
      { contractRole: 'cocoon_worker', _op: 'ext_worker_payout_signed',
        address: { account_address: 'EQA2' }, in_msg: { value: '300', msg_data: {} }, out_msgs: [] },
    ];
    expect(activeWorkers(txs)).toBe(2);
  });
});

describe('activeClients', () => {
  it('counts unique client addresses with charge ops', () => {
    const txs = [
      { contractRole: 'cocoon_proxy', _op: 'client_proxy_request',
        in_msg: { source: 'EQC1', value: '100', msg_data: {} }, out_msgs: [] },
      { contractRole: 'cocoon_client', _op: 'ext_client_charge_signed',
        address: { account_address: 'EQC2' }, in_msg: { value: '50', msg_data: {} }, out_msgs: [] },
      { contractRole: 'cocoon_proxy', _op: 'client_proxy_request',
        in_msg: { source: 'EQC1', value: '100', msg_data: {} }, out_msgs: [] }, // dup
    ];
    expect(activeClients(txs)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
npm test -- src/lib/rateMath.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `src/lib/rateMath.js`:

```js
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
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm test -- src/lib/rateMath.test.js
```

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rateMath.js src/lib/rateMath.test.js
git commit -m "feat(rateMath): add activeWorkers, activeClients, inWindow"
```

---

## Task 5: txClassify — classify tx type for UI badge

**Files:**
- Create: `src/lib/txClassify.js`
- Create: `src/lib/txClassify.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/lib/txClassify.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { classifyTx, TX_TYPE } from './txClassify';

function tx(role, op, { inValue = 0, outValue = 0 } = {}) {
  return {
    contractRole: role,
    _op: op,
    in_msg: { value: String(inValue), msg_data: {} },
    out_msgs: outValue > 0 ? [{ value: String(outValue), msg_data: {} }] : [],
  };
}

describe('classifyTx', () => {
  it('returns WORKER_PAYOUT for ext_worker_payout_signed on worker', () => {
    expect(classifyTx(tx('cocoon_worker', 'ext_worker_payout_signed'))).toBe(TX_TYPE.WORKER_PAYOUT);
  });
  it('returns CLIENT_CHARGE for client_proxy_request on proxy', () => {
    expect(classifyTx(tx('cocoon_proxy', 'client_proxy_request'))).toBe(TX_TYPE.CLIENT_CHARGE);
  });
  it('returns CLIENT_CHARGE for ext_client_charge_signed on client', () => {
    expect(classifyTx(tx('cocoon_client', 'ext_client_charge_signed'))).toBe(TX_TYPE.CLIENT_CHARGE);
  });
  it('returns TOP_UP for client_proxy_top_up or ext_client_top_up', () => {
    expect(classifyTx(tx('cocoon_proxy', 'client_proxy_top_up'))).toBe(TX_TYPE.TOP_UP);
    expect(classifyTx(tx('cocoon_client', 'ext_client_top_up'))).toBe(TX_TYPE.TOP_UP);
  });
  it('returns PROXY_FEE for proxy_save_state or ext_proxy_payout', () => {
    expect(classifyTx(tx('cocoon_proxy', 'ext_proxy_payout'))).toBe(TX_TYPE.PROXY_FEE);
  });
  it('returns OTHER for anything else', () => {
    expect(classifyTx(tx('wallet', null))).toBe(TX_TYPE.OTHER);
    expect(classifyTx(tx('cocoon_wallet', 'excesses'))).toBe(TX_TYPE.OTHER);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
npm test -- src/lib/txClassify.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/txClassify.js`:

```js
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/lib/txClassify.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/txClassify.js src/lib/txClassify.test.js
git commit -m "feat(txClassify): add tx type classifier with UI labels"
```

---

## Task 6: useLiveFeed — rolling buffer + SSE client

**Files:**
- Create: `src/hooks/useLiveFeed.js`
- Create: `src/hooks/useLiveFeed.test.js`
- Modify: `src/api/tonapi.js` (add SSE URL helper + single-tx fetch)

- [ ] **Step 1: Extend `src/api/tonapi.js`**

Append to the existing file:

```js
const TONAPI_BASE = 'https://tonapi.io/v2';
const TONAPI_TOKEN = import.meta.env.VITE_TONAPI_TOKEN || '';

export function sseUrl(accounts) {
  const csv = encodeURIComponent(accounts.join(','));
  return `${TONAPI_BASE}/sse/accounts/transactions?accounts=${csv}`;
}

export function sseHeaders() {
  return TONAPI_TOKEN ? { Authorization: `Bearer ${TONAPI_TOKEN}` } : {};
}

export async function fetchTransactionByHash(hash) {
  const res = await client.get(`/blockchain/transactions/${hash}`);
  return res.data;
}
```

- [ ] **Step 2: Write failing test for buffer behavior**

Create `src/hooks/useLiveFeed.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { __makeBuffer } from './useLiveFeed';

describe('rolling buffer', () => {
  it('pushes items and keeps newest first', () => {
    const buf = __makeBuffer(5);
    buf.push({ id: 'a', utime: 1 });
    buf.push({ id: 'b', utime: 2 });
    expect(buf.items().map(x => x.id)).toEqual(['b', 'a']);
  });

  it('caps at capacity, dropping oldest', () => {
    const buf = __makeBuffer(3);
    for (let i = 0; i < 5; i++) buf.push({ id: String(i), utime: i });
    expect(buf.items().map(x => x.id)).toEqual(['4', '3', '2']);
  });

  it('deduplicates by id', () => {
    const buf = __makeBuffer(5);
    buf.push({ id: 'a', utime: 1 });
    buf.push({ id: 'a', utime: 1 });
    expect(buf.items()).toHaveLength(1);
  });

  it('filters txsInWindow by utime', () => {
    const buf = __makeBuffer(10);
    const now = 1_700_000_000;
    buf.push({ id: 'old', utime: now - 7200 });
    buf.push({ id: 'new', utime: now - 10 });
    const recent = buf.txsInWindow(60 * 60 * 1000, now * 1000);
    expect(recent.map(x => x.id)).toEqual(['new']);
  });
});
```

- [ ] **Step 3: Run — expect fail**

```bash
npm test -- src/hooks/useLiveFeed.test.js
```

Expected: FAIL (module not found).

- [ ] **Step 4: Implement hook + buffer**

Create `src/hooks/useLiveFeed.js`:

```js
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
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/hooks/useLiveFeed.test.js
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useLiveFeed.js src/hooks/useLiveFeed.test.js src/api/tonapi.js
git commit -m "feat(useLiveFeed): rolling buffer + SSE stream from tonapi"
```

---

## Task 7: Rewrite useNetworkData — integrate graph + live feed

**Files:**
- Modify: `src/hooks/useNetworkData.js` (full rewrite)

- [ ] **Step 1: Replace file contents**

Replace the entire `src/hooks/useNetworkData.js` with:

```js
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchDiscovery } from '../api/backend';
import { useLiveFeed } from './useLiveFeed';
import { DISCOVERY_INTERVAL_MS } from '../constants';

const ACTIVE_WINDOW_MS = 60 * 60 * 1000; // 1h — fixed per spec

function buildGraph(raw) {
  const graph = {
    root: raw.root,
    proxies: new Map(),
    clients: new Map(),
    workers: new Map(),
    cocoonWallets: new Map(),
    relatedWallets: new Map(),
    seedTxs: raw.transactions || [],
    computeMetrics: raw.computeMetrics || null,
    pricePerToken: raw.root?.config?.pricePerToken || 20,
  };
  for (const p of raw.proxies || []) graph.proxies.set(p.address, {
    ...p,
    clients: new Map((p.clients || []).map(a => [a, { address: a }])),
    workers: new Map((p.workers || []).map(a => [a, { address: a }])),
  });
  for (const c of raw.clients || []) graph.clients.set(c.address, c);
  for (const w of raw.workers || []) graph.workers.set(w.address, w);
  for (const cw of raw.cocoonWallets || []) graph.cocoonWallets.set(cw.address, cw);
  for (const rw of raw.relatedWallets || []) graph.relatedWallets.set(rw.address, rw);
  return graph;
}

function tagRole(graph, tx) {
  const addr = tx.address?.account_address;
  if (!addr) return tx;
  if (graph.proxies.has(addr)) tx.contractRole = 'cocoon_proxy';
  else if (graph.clients.has(addr)) tx.contractRole = 'cocoon_client';
  else if (graph.workers.has(addr)) tx.contractRole = 'cocoon_worker';
  else if (graph.cocoonWallets.has(addr)) tx.contractRole = 'cocoon_wallet';
  else if (addr === graph.root?.address) tx.contractRole = 'root';
  return tx;
}

export function useNetworkData() {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [fallbackPoll, setFallbackPoll] = useState(false);
  const seedRef = useRef([]);

  const refresh = useCallback(async () => {
    try {
      const raw = await fetchDiscovery();
      const g = buildGraph(raw);
      setGraph(g);
      seedRef.current = g.seedTxs.map(tx => tagRole(g, tx));
      setLastRefresh(new Date());
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Discovery failed:', err);
      setError(err.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const interval = setInterval(refresh, DISCOVERY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const accounts = useMemo(() => {
    if (!graph) return [];
    return [graph.root.address, ...graph.proxies.keys()];
  }, [graph]);

  const { buffer, version, connected } = useLiveFeed({
    accounts,
    seed: seedRef.current,
    onFallback: useCallback(() => setFallbackPoll(true), []),
  });

  // Fallback polling when SSE is down
  useEffect(() => {
    if (!fallbackPoll) return;
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [fallbackPoll, refresh]);

  // Tag role on streamed txs that lack it (tonapi stream doesn't know role)
  useEffect(() => {
    if (!graph) return;
    for (const tx of buffer.items()) {
      if (!tx.contractRole) tagRole(graph, tx);
    }
  }, [version, graph]);

  const lastTxUtime = useMemo(() => {
    const items = buffer.items();
    return items[0]?.utime || 0;
  }, [version]);

  const isAlive = useMemo(() => {
    const nowSec = Date.now() / 1000;
    return lastTxUtime > 0 && (nowSec - lastTxUtime) < 300;
  }, [lastTxUtime]);

  return {
    graph,
    buffer,
    bufferVersion: version,
    activeWindowMs: ACTIVE_WINDOW_MS,
    isAlive,
    lastTxUtime,
    connected,
    fallbackPoll,
    loading,
    error,
    lastRefresh,
    refresh,
  };
}
```

- [ ] **Step 2: Sanity — ensure build still runs**

```bash
npm run build
```

Expected: build succeeds (there will be unused imports in `App.jsx` from the old code — those get cleaned in later tasks). If it fails with references to old shape, that's expected; we'll rewire `App.jsx` in Task 14. If you get a non-structural error (syntax, etc.), fix it before commit.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useNetworkData.js
git commit -m "refactor(useNetworkData): expose graph + live buffer; drop precomputed stats"
```

---

## Task 8: Sparkline component

**Files:**
- Create: `src/components/Sparkline.jsx`

- [ ] **Step 1: Create the file**

```jsx
// Raw-SVG sparkline. No deps. Props: values (number[]), color, height, width.
export default function Sparkline({ values = [], color = '#3fb950', height = 24, width = 100 }) {
  if (values.length < 2) {
    return <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sparkline.jsx
git commit -m "feat(Sparkline): raw-SVG mini trend chart"
```

---

## Task 9: WindowToggle component

**Files:**
- Create: `src/components/WindowToggle.jsx`

- [ ] **Step 1: Create**

```jsx
import { HStack, Button } from '@chakra-ui/react';

export const WINDOWS = [
  { id: '1h',  label: '1h',  ms: 60 * 60 * 1000 },
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d',  label: '7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All', ms: Infinity },
];

export default function WindowToggle({ value, onChange }) {
  return (
    <HStack spacing={1}>
      {WINDOWS.map(w => (
        <Button
          key={w.id}
          size="xs"
          variant={value === w.id ? 'solid' : 'ghost'}
          bg={value === w.id ? 'rgba(63,185,80,0.15)' : 'transparent'}
          color={value === w.id ? '#3fb950' : 'gray.400'}
          borderWidth="1px"
          borderColor={value === w.id ? 'rgba(63,185,80,0.35)' : '#30363d'}
          borderRadius="md"
          _hover={{ bg: value === w.id ? 'rgba(63,185,80,0.2)' : '#21262d' }}
          onClick={() => onChange(w.id)}
          fontWeight="500"
          fontSize="xs"
          px={3}
        >
          {w.label}
        </Button>
      ))}
    </HStack>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WindowToggle.jsx
git commit -m "feat(WindowToggle): 1h/24h/7d/all time window toggle"
```

---

## Task 10: LiveHero component

**Files:**
- Create: `src/components/LiveHero.jsx`

- [ ] **Step 1: Create**

```jsx
import { Box, Flex, HStack, Text, Grid } from '@chakra-ui/react';
import Sparkline from './Sparkline';
import WindowToggle, { WINDOWS } from './WindowToggle';
import {
  computeSpend, workerRevenue, commission, tokensProcessed, inWindow,
} from '../lib/rateMath';

function fmtTon(nano) {
  const ton = nano / 1e9;
  if (ton >= 1000) return `${(ton / 1000).toFixed(1)}K`;
  if (ton >= 10) return ton.toFixed(1);
  if (ton >= 1) return ton.toFixed(2);
  return ton.toFixed(3);
}
function fmtCount(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
function timeAgo(utime) {
  if (!utime) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - utime));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

// Convert window "per-hour rate": divide window total by (windowMs / 3600_000)
function asHourlyRate(total, windowMs) {
  if (!isFinite(windowMs) || windowMs === 0) return total;
  return total / (windowMs / (60 * 60 * 1000));
}

// 24 sparkline buckets, each is one hour
function bucketSparkline(txs, valueFn, bucketMs = 60 * 60 * 1000, buckets = 24) {
  const now = Date.now();
  const out = new Array(buckets).fill(0);
  for (const tx of txs) {
    const age = now - (tx.utime || 0) * 1000;
    if (age < 0 || age > bucketMs * buckets) continue;
    const idx = buckets - 1 - Math.floor(age / bucketMs);
    out[idx] += valueFn(tx);
  }
  return out;
}

export default function LiveHero({
  isAlive, lastTxUtime, bufferRef, bufferVersion, pricePerToken = 20,
  window: windowId, onWindowChange,
}) {
  const w = WINDOWS.find(x => x.id === windowId) || WINDOWS[0];
  const allTxs = bufferRef.items();
  const windowTxs = isFinite(w.ms) ? inWindow(allTxs, w.ms) : allTxs;
  const last24h = inWindow(allTxs, 24 * 60 * 60 * 1000);

  const spend = computeSpend(windowTxs);
  const rev = workerRevenue(windowTxs);
  const com = commission(windowTxs);
  const tok = tokensProcessed(windowTxs, pricePerToken);

  const spendHourly = asHourlyRate(spend, w.ms);
  const revHourly = asHourlyRate(rev, w.ms);
  const comHourly = asHourlyRate(com, w.ms);
  const tokHourly = asHourlyRate(tok, w.ms);

  const sparkSpend = bucketSparkline(last24h, tx =>
    (tx.contractRole === 'cocoon_proxy' && tx._op === 'client_proxy_request') ||
    (tx.contractRole === 'cocoon_client' && tx._op === 'ext_client_charge_signed')
      ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);
  const sparkRev = bucketSparkline(last24h, tx =>
    tx.contractRole === 'cocoon_worker' && tx._op === 'ext_worker_payout_signed'
      ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);

  return (
    <Box>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={3} mb={4}>
        <Box>
          <HStack spacing={2} mb={2}>
            <Box as="span" w="8px" h="8px" borderRadius="full" bg={isAlive ? '#3fb950' : '#8b949e'}
                 boxShadow={isAlive ? '0 0 0 0 rgba(63,185,80,0.6)' : 'none'}
                 sx={{ animation: isAlive ? 'pulse 1.4s infinite' : 'none',
                       '@keyframes pulse': {
                          '0%': { boxShadow: '0 0 0 0 rgba(63,185,80,0.6)' },
                          '70%': { boxShadow: '0 0 0 10px rgba(63,185,80,0)' },
                          '100%': { boxShadow: '0 0 0 0 rgba(63,185,80,0)' }
                       } }} />
            <Text fontSize="xs" fontWeight="600" letterSpacing="wide" color={isAlive ? '#3fb950' : '#8b949e'}>
              {isAlive ? 'LIVE' : 'IDLE'}
            </Text>
          </HStack>
          <Text fontSize="28px" fontWeight="700" color="#f0f6fc" lineHeight="1">Cocoon Network</Text>
          <Text fontSize="xs" color="#58a6ff" fontFamily="mono" mt={2}>
            last tx <b>{timeAgo(lastTxUtime)} ago</b>
          </Text>
        </Box>
        <Box>
          <Text fontSize="10px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em" mb={1}>
            Time window
          </Text>
          <WindowToggle value={windowId} onChange={onWindowChange} />
        </Box>
      </Flex>

      <Grid templateColumns={{ base: '1fr 1fr', lg: 'repeat(4, 1fr)' }} gap={3}>
        <KpiCell
          label="Compute spend" valueMain={fmtTon(spendHourly * 1e9)} unit="TON/hr"
          sub="paid by clients" accent values={sparkSpend} color="#3fb950"
        />
        <KpiCell
          label="Worker revenue" valueMain={fmtTon(revHourly * 1e9)} unit="TON/hr"
          sub={spend > 0 ? `${Math.round((rev / spend) * 100)}% of spend` : 'paid to workers'}
          values={sparkRev} color="#58a6ff"
        />
        <KpiCell
          label="Network commission" valueMain={fmtTon(comHourly * 1e9)} unit="TON/hr"
          sub={spend > 0 ? `${Math.round((com / spend) * 100)}% take · proxies+root` : 'proxies + root'}
          values={sparkSpend.map((v, i) => v - sparkRev[i])} color="#d29922"
        />
        <KpiCell
          label="Tokens processed" valueMain={fmtCount(tokHourly)} unit="/hr"
          sub="~ price_per_token: 20 nanoTON" values={sparkSpend} color="#a371f7"
        />
      </Grid>
    </Box>
  );
}

function KpiCell({ label, valueMain, unit, sub, values, color, accent }) {
  return (
    <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={3}
         position="relative" overflow="hidden">
      {accent && <Box position="absolute" top={0} left={0} w="3px" h="100%" bg="#3fb950" />}
      <Text fontSize="10px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em">{label}</Text>
      <Text fontSize="22px" fontWeight="600" color="#f0f6fc" mt={1}>
        {valueMain} <Text as="span" fontSize="12px" color="#7d8590" fontWeight="400">{unit}</Text>
      </Text>
      <Text fontSize="11px" color="#8b949e" mt={1}>{sub}</Text>
      <Box mt={2}><Sparkline values={values} color={color} height={24} width={100} /></Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LiveHero.jsx
git commit -m "feat(LiveHero): pulse header with 4 rate KPIs + 24h sparklines"
```

---

## Task 11: TrendCharts component

**Files:**
- Create: `src/components/TrendCharts.jsx`

- [ ] **Step 1: Create**

```jsx
import { Box, Grid, HStack, Text } from '@chakra-ui/react';
import { WINDOWS } from './WindowToggle';
import { computeSpend, workerRevenue, commission, inWindow } from '../lib/rateMath';

function bucket(txs, windowMs, bucketCount, valueFn) {
  const now = Date.now();
  const step = windowMs / bucketCount;
  const out = new Array(bucketCount).fill(0);
  for (const tx of txs) {
    const age = now - (tx.utime || 0) * 1000;
    if (age < 0 || age >= windowMs) continue;
    const idx = bucketCount - 1 - Math.floor(age / step);
    if (idx >= 0 && idx < bucketCount) out[idx] += valueFn(tx);
  }
  return out;
}

function buildArea(values, w, h, pad = 2) {
  if (values.length < 2) return '';
  const max = Math.max(...values, 1);
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts[0]} L${pts.slice(1).join(' L')} L${(pad + (values.length - 1) * step).toFixed(1)},${(h - pad).toFixed(1)} L${pad},${(h - pad).toFixed(1)} Z`;
}

function Donut({ slices }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 38, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#30363d" strokeWidth="12" />
      {slices.map((s, i) => {
        const len = (s.value / total) * circ;
        const seg = (
          <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="12"
                  strokeDasharray={`${len} ${circ}`} strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)" />
        );
        offset += len;
        return seg;
      })}
    </svg>
  );
}

export default function TrendCharts({ bufferRef, bufferVersion, window: windowId }) {
  const w = WINDOWS.find(x => x.id === windowId) || WINDOWS[0];
  const windowMs = isFinite(w.ms) ? w.ms : 30 * 24 * 60 * 60 * 1000; // "all" renders last 30d
  const allTxs = bufferRef.items();
  const windowTxs = inWindow(allTxs, windowMs);

  const buckets = windowId === '1h' ? 30 : windowId === '24h' ? 24 : windowId === '7d' ? 24 * 7 : 30;
  const spendBuckets = bucket(windowTxs, windowMs, buckets, tx =>
    (tx.contractRole === 'cocoon_proxy' && tx._op === 'client_proxy_request') ||
    (tx.contractRole === 'cocoon_client' && tx._op === 'ext_client_charge_signed')
      ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);
  const revBuckets = bucket(windowTxs, windowMs, buckets, tx =>
    tx.contractRole === 'cocoon_worker' && tx._op === 'ext_worker_payout_signed'
      ? parseInt(tx.in_msg?.value || '0', 10) / 1e9 : 0);

  const spend = computeSpend(windowTxs) / 1e9;
  const rev = workerRevenue(windowTxs) / 1e9;
  const com = commission(windowTxs) / 1e9;

  return (
    <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={3}>
      <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={4}>
        <Text fontSize="13px" fontWeight="600" color="#e6edf3">
          TON flow · compute spend vs worker payouts
        </Text>
        <Text fontSize="11px" color="#8b949e" mt={1} mb={2}>
          Selected window: {w.label} · stacked areas
        </Text>
        <svg viewBox="0 0 400 120" width="100%" height="120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3fb950" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3fb950" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#58a6ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={buildArea(spendBuckets, 400, 120)} fill="url(#gSpend)" stroke="#3fb950" strokeWidth="1.5" />
          <path d={buildArea(revBuckets, 400, 120)} fill="url(#gRev)" stroke="#58a6ff" strokeWidth="1.5" />
        </svg>
        <HStack spacing={4} mt={2}>
          <Text fontSize="11px" color="#8b949e">
            <Box as="span" display="inline-block" w="9px" h="9px" bg="#3fb950" borderRadius="2px" mr={1} />
            Compute spend · {spend.toFixed(2)} TON
          </Text>
          <Text fontSize="11px" color="#8b949e">
            <Box as="span" display="inline-block" w="9px" h="9px" bg="#58a6ff" borderRadius="2px" mr={1} />
            Worker payouts · {rev.toFixed(2)} TON
          </Text>
        </HStack>
      </Box>

      <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={4}>
        <Text fontSize="13px" fontWeight="600" color="#e6edf3">Where the TON goes</Text>
        <Text fontSize="11px" color="#8b949e" mt={1}>commission split · {w.label}</Text>
        <HStack spacing={4} mt={2} align="center">
          <Donut slices={[
            { color: '#3fb950', value: rev },
            { color: '#d29922', value: com },
          ]} />
          <Box fontSize="12px" color="#e6edf3">
            <HStack><Box w="9px" h="9px" bg="#3fb950" borderRadius="50%" /><Text>Workers · {spend > 0 ? Math.round((rev / spend) * 100) : 0}%</Text></HStack>
            <HStack><Box w="9px" h="9px" bg="#d29922" borderRadius="50%" /><Text>Commission · {spend > 0 ? Math.round((com / spend) * 100) : 0}%</Text></HStack>
          </Box>
        </HStack>
      </Box>
    </Grid>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TrendCharts.jsx
git commit -m "feat(TrendCharts): stacked area + commission donut"
```

---

## Task 12: ActorsPanel component

**Files:**
- Create: `src/components/ActorsPanel.jsx`

- [ ] **Step 1: Create**

```jsx
import { Box, Grid, Text, HStack, VStack } from '@chakra-ui/react';
import { activeWorkers, activeClients, inWindow } from '../lib/rateMath';
import { classifyTx, TX_TYPE_LABEL } from '../lib/txClassify';

const ACTIVE_MS = 60 * 60 * 1000; // fixed 1h per spec

function short(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
function ago(utime) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - utime));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
function fmtVal(nano) {
  const ton = parseInt(nano || '0', 10) / 1e9;
  return ton.toFixed(ton >= 1 ? 2 : 4);
}

export default function ActorsPanel({ graph, bufferRef, bufferVersion }) {
  if (!graph) return null;
  const all = bufferRef.items();
  const recent = inWindow(all, ACTIVE_MS);

  const totalWorkers = graph.workers.size;
  const totalClients = graph.clients.size;
  const activeW = activeWorkers(recent);
  const activeC = activeClients(recent);

  const feed = all
    .map(tx => ({ ...tx, _type: classifyTx(tx) }))
    .filter(tx => tx._type !== 'other')
    .slice(0, 10);

  return (
    <Box>
      <Text fontSize="11px" textTransform="uppercase" color="#7d8590" letterSpacing="0.1em" mb={3} fontWeight="600">
        Who's active right now
      </Text>
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 1.4fr' }} gap={3}>
        <ActorBox n={activeW} total={totalWorkers} label="Workers earning (1h)"
                  detail={`${activeW} received payouts · ${Math.max(0, totalWorkers - activeW)} idle`} />
        <ActorBox n={activeC} total={totalClients} label="Clients spending (1h)"
                  detail={`${activeC} charged inference · ${Math.max(0, totalClients - activeC)} idle`} />
        <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={3}>
          <Text fontSize="11px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em" mb={2}>
            Live event feed
          </Text>
          <VStack spacing={0} align="stretch">
            {feed.length === 0 && <Text fontSize="11px" color="#7d8590">Waiting for events…</Text>}
            {feed.map(tx => {
              const info = TX_TYPE_LABEL[tx._type];
              return (
                <HStack key={tx.id} justify="space-between" py={1}
                        borderBottom="1px solid rgba(48,54,61,0.5)" fontFamily="mono" fontSize="11px">
                  <Text color="#7d8590" w="40px">{ago(tx.utime)}</Text>
                  <HStack flex={1} spacing={2}>
                    <Box as="span" fontSize="9px" px={1.5} py={0.5} borderRadius="3px"
                         bg={info.bg} color={info.color} textTransform="uppercase" letterSpacing="0.04em">
                      {info.label}
                    </Box>
                    <Text color="#58a6ff">{short(tx.address?.account_address)}</Text>
                  </HStack>
                  <Text color="#3fb950" fontWeight="600">+{fmtVal(tx.in_msg?.value)}</Text>
                </HStack>
              );
            })}
          </VStack>
        </Box>
      </Grid>
    </Box>
  );
}

function ActorBox({ n, total, label, detail }) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <Box bg="#161b22" border="1px solid #30363d" borderRadius="10px" p={3}>
      <Text fontSize="36px" fontWeight="700" color="#f0f6fc" lineHeight="1">
        {n}<Text as="span" fontSize="15px" color="#7d8590" fontWeight="400">{` / ${total}`}</Text>
      </Text>
      <Text fontSize="11px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em" mt={2}>{label}</Text>
      <Text fontSize="11px" color="#8b949e" mt={2}>{detail}</Text>
      <Box h="4px" bg="#30363d" borderRadius="2px" mt={3} overflow="hidden">
        <Box h="100%" w={`${pct}%`} bgGradient="linear(to-r, #3fb950, #58a6ff)" />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ActorsPanel.jsx
git commit -m "feat(ActorsPanel): 1h worker/client active counts + live event feed"
```

---

## Task 13: ResultCard + AddressLookup

**Files:**
- Create: `src/components/ResultCard.jsx`
- Create: `src/components/AddressLookup.jsx`

- [ ] **Step 1: Create `ResultCard.jsx`**

```jsx
import { Box, HStack, VStack, Text, Grid, Button, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

const ROLE_META = {
  root:           { label: 'Root',         color: '#f57520', bg: 'rgba(245,117,32,0.18)', border: 'rgba(245,117,32,0.35)' },
  cocoon_proxy:   { label: 'Proxy',        color: '#a371f7', bg: 'rgba(163,113,247,0.18)', border: 'rgba(163,113,247,0.35)' },
  cocoon_client:  { label: 'Client',       color: '#58a6ff', bg: 'rgba(88,166,255,0.18)', border: 'rgba(88,166,255,0.35)' },
  cocoon_worker:  { label: 'Worker',       color: '#d29922', bg: 'rgba(210,153,34,0.18)', border: 'rgba(210,153,34,0.35)' },
  cocoon_wallet:  { label: 'Cocoon wallet',color: '#3fb950', bg: 'rgba(63,185,80,0.18)', border: 'rgba(63,185,80,0.35)' },
};

function short(addr) { return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''; }
function ago(utime) {
  if (!utime) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - utime));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function ResultCard({ address, classification, graph, onDismiss }) {
  const { type, balance, state, lastActivity, codeHash, interfaces = [] } = classification;
  const isCocoon = type && type.startsWith('cocoon_') || type === 'root';
  const meta = ROLE_META[type];

  let relationship = null;
  if (isCocoon && graph) {
    if (type === 'cocoon_proxy') {
      const proxy = graph.proxies.get(address);
      relationship = proxy
        ? `Registered by root · serves ${proxy.clients?.size || 0} clients and ${proxy.workers?.size || 0} workers`
        : `Cocoon proxy contract`;
    } else if (type === 'cocoon_client') {
      const client = graph.clients.get(address);
      relationship = client?.proxyAddress
        ? `Registered by proxy ${short(client.proxyAddress)}`
        : `Cocoon client contract`;
    } else if (type === 'cocoon_worker') {
      const worker = graph.workers.get(address);
      relationship = worker?.proxyAddress
        ? `Registered by proxy ${short(worker.proxyAddress)}`
        : `Cocoon worker contract`;
    } else if (type === 'cocoon_wallet') {
      relationship = `Cocoon wallet contract — holds funds used for inference charges`;
    } else if (type === 'root') {
      relationship = `Root contract — stores network config, proxy registry, and allowed code hashes`;
    }
  } else {
    relationship = `This address has no interaction with Cocoon contracts.`;
  }

  return (
    <Box
      bg={isCocoon ? 'linear-gradient(180deg, rgba(63,185,80,0.05), #161b22 60%)' : '#161b22'}
      border="1px solid"
      borderColor={isCocoon ? 'rgba(63,185,80,0.4)' : '#30363d'}
      borderRadius="12px" p={4} mb={4}
    >
      <Grid templateColumns="auto 1fr auto" gap={4} alignItems="start">
        <Box w="56px" h="56px" borderRadius="12px" display="flex" alignItems="center" justifyContent="center"
             fontSize="24px" fontWeight="700"
             bg={isCocoon ? 'rgba(63,185,80,0.2)' : 'rgba(139,148,158,0.1)'}
             color={isCocoon ? '#3fb950' : '#8b949e'}>
          {isCocoon ? '✓' : '?'}
        </Box>
        <Box>
          <HStack>
            <Box as="span" px={2} py={0.5} borderRadius="999px" fontSize="10px" fontWeight="600"
                 textTransform="uppercase" letterSpacing="0.04em"
                 bg={isCocoon ? 'rgba(63,185,80,0.2)' : 'rgba(139,148,158,0.15)'}
                 color={isCocoon ? '#3fb950' : '#8b949e'}
                 border={`1px solid ${isCocoon ? 'rgba(63,185,80,0.45)' : 'rgba(139,148,158,0.35)'}`}>
              {isCocoon ? 'COCOON' : 'NOT COCOON'}
            </Box>
            {meta && (
              <Box as="span" px={2} py={0.5} borderRadius="999px" fontSize="10px" fontWeight="600"
                   textTransform="uppercase" letterSpacing="0.04em"
                   bg={meta.bg} color={meta.color} border={`1px solid ${meta.border}`}>
                {meta.label}
              </Box>
            )}
          </HStack>
          <Text fontFamily="mono" fontSize="12px" color="#58a6ff" mt={1} wordBreak="break-all">{address}</Text>
          <Text fontSize="12px" color="#8b949e" mt={3} p={2} bg="#0d1117" borderRadius="6px"
                border="1px dashed #30363d">
            {relationship}
          </Text>
          <Grid templateColumns="repeat(4, 1fr)" gap={3} mt={3} pt={3} borderTop="1px solid #30363d">
            <Fact k="Balance" v={`${(parseInt(balance || '0', 10) / 1e9).toFixed(2)} TON`} />
            <Fact k="State" v={state || '—'} color={state === 'active' ? '#3fb950' : '#e6edf3'} />
            <Fact k="Last activity" v={ago(lastActivity)} />
            <Fact k="Code hash" v={codeHash ? `${codeHash.slice(0, 4)}…${codeHash.slice(-4)}` : '—'}
                  fontFamily="mono" />
          </Grid>
        </Box>
        <VStack spacing={1} align="stretch">
          {isCocoon && (
            <Button as={RouterLink} to={`/address/${address}`} size="sm"
                    bg="#238636" color="white" _hover={{ bg: '#2ea043' }}>
              View details →
            </Button>
          )}
          <Button size="sm" variant="outline" borderColor="#30363d" color="#c9d1d9"
                  onClick={() => navigator.clipboard.writeText(address)}>
            Copy address
          </Button>
          <Link href={`https://tonviewer.com/${address}`} isExternal>
            <Button size="sm" variant="outline" borderColor="#30363d" color="#c9d1d9" w="full">
              Tonviewer ↗
            </Button>
          </Link>
          <Button size="xs" variant="ghost" color="#7d8590" onClick={onDismiss}>
            ✕ Dismiss
          </Button>
        </VStack>
      </Grid>
    </Box>
  );
}

function Fact({ k, v, color = '#e6edf3', fontFamily = 'inherit' }) {
  return (
    <Box>
      <Text fontSize="10px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em">{k}</Text>
      <Text fontSize="14px" color={color} mt={1} fontWeight="500" fontFamily={fontFamily}>{v}</Text>
    </Box>
  );
}
```

- [ ] **Step 2: Create `AddressLookup.jsx`**

```jsx
import { useState } from 'react';
import { Box, Input, InputGroup, InputLeftElement, Spinner, Text } from '@chakra-ui/react';
import { Address } from '@ton/core';
import { fetchAccountType } from '../api/backend';
import ResultCard from './ResultCard';

function isValidAddress(v) {
  try { Address.parse(v.trim()); return true; } catch { return false; }
}

export default function AddressLookup({ graph }) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [classification, setClassification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const addr = value.trim();
    if (!addr) return;
    if (!isValidAddress(addr)) {
      setError('Invalid TON address');
      setClassification(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSubmitted(addr);
    try {
      const result = await fetchAccountType(addr);
      setClassification(result);
    } catch (err) {
      setError(err.message || 'Lookup failed');
      setClassification(null);
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    setSubmitted('');
    setClassification(null);
    setError(null);
    setValue('');
  }

  return (
    <Box>
      <form onSubmit={submit}>
        <InputGroup size="md" maxW={{ base: '100%', md: '520px' }}>
          <InputLeftElement pointerEvents="none" color="gray.500">
            <SearchIcon />
          </InputLeftElement>
          <Input
            placeholder="Paste any TON address to check if it's part of Cocoon…"
            value={value}
            onChange={e => { setValue(e.target.value); if (error) setError(null); }}
            bg="#0d1117" border="1px solid #30363d" borderRadius="lg"
            color="#e6edf3" fontFamily="mono" fontSize="12px"
            _placeholder={{ color: '#7d8590' }}
            _hover={{ borderColor: '#484f58' }}
            _focus={{ borderColor: '#3fb950', boxShadow: '0 0 0 1px #3fb950' }}
          />
        </InputGroup>
      </form>

      {loading && (
        <Box mt={3} p={3} bg="#161b22" border="1px solid #30363d" borderRadius="lg">
          <Spinner size="sm" color="#3fb950" mr={2} /> <Text as="span" color="#8b949e" fontSize="13px">Resolving {submitted.slice(0, 10)}…</Text>
        </Box>
      )}
      {error && (
        <Box mt={3} p={3} bg="rgba(248,81,73,0.1)" border="1px solid rgba(248,81,73,0.4)" borderRadius="lg">
          <Text color="#f85149" fontSize="13px">{error}</Text>
        </Box>
      )}
      {classification && (
        <Box mt={3}>
          <ResultCard address={submitted} classification={classification} graph={graph} onDismiss={dismiss} />
        </Box>
      )}
    </Box>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultCard.jsx src/components/AddressLookup.jsx
git commit -m "feat(AddressLookup): inline Cocoon verdict card"
```

---

## Task 14: Update Header (swap SearchInput → AddressLookup)

**Files:**
- Modify: `src/components/Header.jsx`

- [ ] **Step 1: Rewrite Header**

Replace the entire file with:

```jsx
import { Box, Flex, Heading, HStack, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export default function Header({ connected, lastRefresh, fallbackPoll }) {
  return (
    <Flex as="header" align="center" justify="space-between"
          px={{ base: 4, md: 8 }} py={4}
          borderBottom="1px" borderColor="#30363d" bg="#0d1117"
          position="sticky" top={0} zIndex={10} gap={4} flexWrap="wrap">
      <HStack spacing={4} as={RouterLink} to="/" _hover={{ opacity: 0.8 }} cursor="pointer">
        <CocoonLogo />
        <Box>
          <Heading size="md" color="white" letterSpacing="-0.02em">Cocoon Network</Heading>
          <Text fontSize="xs" color="gray.500">Decentralized AI Inference Dashboard</Text>
        </Box>
      </HStack>
      <HStack spacing={3}>
        {fallbackPoll && (
          <Text fontSize="xs" color="#d29922">Live stream offline — polling cache</Text>
        )}
        <HStack spacing={2}>
          <Box w="8px" h="8px" borderRadius="full"
               bg={connected ? '#3fb950' : '#f85149'}
               boxShadow={connected ? '0 0 6px rgba(63,185,80,0.6)' : 'none'} />
          <Text fontSize="xs" color={connected ? '#3fb950' : '#f85149'}>
            {connected ? 'Stream connected' : 'Disconnected'}
          </Text>
        </HStack>
        {lastRefresh && (
          <Text fontSize="xs" color="gray.500" display={{ base: 'none', md: 'block' }}>
            Snapshot · {lastRefresh.toLocaleTimeString()}
          </Text>
        )}
      </HStack>
    </Flex>
  );
}

function CocoonLogo() {
  return (
    <Box w={10} h={10} borderRadius="lg" bg="brand.400"
         display="flex" alignItems="center" justifyContent="center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.jsx
git commit -m "refactor(Header): show stream connection state; drop inline search"
```

---

## Task 15: Update TransactionFeed with opcode badges

**Files:**
- Modify: `src/components/TransactionFeed.jsx`

- [ ] **Step 1: Update imports**

Replace this line:

```jsx
import { timeAgo, nanoToTon, classifyTransaction } from '../lib/formatters';
```

with:

```jsx
import { timeAgo, nanoToTon } from '../lib/formatters';
import { classifyTx, TX_TYPE_LABEL } from '../lib/txClassify';
```

- [ ] **Step 2: Remove the `TYPE_COLORS` constant (lines 11–18)**

Delete the entire block:

```jsx
const TYPE_COLORS = {
  payment: 'teal',
  'top-up': 'green',
  withdrawal: 'orange',
  deployment: 'purple',
  bounce: 'red',
  other: 'gray',
};
```

- [ ] **Step 3: Replace the Type cell (lines 79–91)**

Find the existing block inside the row render:

```jsx
                      <Td>
                        {opcode ? (
                          <Tooltip label={`${opcode.desc} (${opcode.opcode})`} hasArrow placement="top">
                            <Badge colorScheme={opcode.color} variant="subtle" fontSize="xs" cursor="help">
                              {opcode.name}
                            </Badge>
                          </Tooltip>
                        ) : (
                          <Badge colorScheme={TYPE_COLORS[txType]} variant="subtle" fontSize="xs">
                            {txType}
                          </Badge>
                        )}
                      </Td>
```

Replace it with:

```jsx
                      <Td>
                        {(() => {
                          const t = classifyTx(tx);
                          const info = TX_TYPE_LABEL[t];
                          return (
                            <Tooltip label={opcode ? `${opcode.desc} (${opcode.opcode})` : info.label} hasArrow placement="top">
                              <Box as="span" px={2} py={0.5} fontSize="9px" fontWeight="600"
                                   textTransform="uppercase" letterSpacing="0.04em" borderRadius="3px"
                                   bg={info.bg} color={info.color} cursor="help">
                                {info.label}
                              </Box>
                            </Tooltip>
                          );
                        })()}
                      </Td>
```

- [ ] **Step 4: Remove now-unused local `txType` variable**

In the row render, the line `const txType = classifyTransaction(tx);` is no longer referenced — delete it. Keep the `const opcode = parseTxOpcode(tx);` line (still used for tooltip detail).

- [ ] **Step 5: Remove `Badge` from imports (no longer used)**

Change:

```jsx
import {
  Card, CardBody, CardHeader, Heading,
  Table, Thead, Tbody, Tr, Th, Td,
  Badge, Text, Box, HStack, Tooltip,
} from '@chakra-ui/react';
```

to:

```jsx
import {
  Card, CardBody, CardHeader, Heading,
  Table, Thead, Tbody, Tr, Th, Td,
  Text, Box, HStack, Tooltip,
} from '@chakra-ui/react';
```

- [ ] **Step 6: Verify dev server renders**

```bash
npm run dev
```

Visit `http://localhost:5173`, scroll to transaction feed, confirm every row has a colored badge (worker payout / client charge / top-up / proxy fee / other). Ctrl+C when done.

- [ ] **Step 7: Commit**

```bash
git add src/components/TransactionFeed.jsx
git commit -m "feat(TransactionFeed): opcode-classified type badges"
```

---

## Task 16: Rewrite App.jsx — wire everything together

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace file contents**

```jsx
import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link as RouterLink } from 'react-router-dom';
import { Box, VStack, Spinner, Center, Text, Alert, AlertIcon, HStack, Link } from '@chakra-ui/react';
import { useNetworkData } from './hooks/useNetworkData';
import Header from './components/Header';
import LiveHero from './components/LiveHero';
import TrendCharts from './components/TrendCharts';
import ActorsPanel from './components/ActorsPanel';
import AddressLookup from './components/AddressLookup';
import ProxyCards from './components/ProxyCards';
import TransactionFeed from './components/TransactionFeed';
import AddressDetail from './pages/AddressDetail';

function Dashboard({ data, error }) {
  const [windowId, setWindowId] = useState('1h');
  if (!data.graph) return null;
  const { graph, buffer, bufferVersion, isAlive, lastTxUtime } = data;

  return (
    <Box px={{ base: 4, lg: 8 }} py={6} maxW="1400px" mx="auto">
      <VStack spacing={6} align="stretch">
        {error && (
          <Alert status="warning" variant="subtle" borderRadius="lg" bg="orange.900" color="orange.200">
            <AlertIcon /> Data may be stale: {error}
          </Alert>
        )}

        <AddressLookup graph={graph} />

        <LiveHero
          isAlive={isAlive} lastTxUtime={lastTxUtime}
          bufferRef={buffer} bufferVersion={bufferVersion}
          pricePerToken={graph.pricePerToken}
          window={windowId} onWindowChange={setWindowId}
        />

        <TrendCharts bufferRef={buffer} bufferVersion={bufferVersion} window={windowId} />

        <ActorsPanel graph={graph} bufferRef={buffer} bufferVersion={bufferVersion} />

        <ProxyCards
          rootConfig={graph.root?.config}
          proxies={graph.proxies}
          clients={graph.clients}
          workers={graph.workers}
          cocoonWallets={graph.cocoonWallets}
        />

        <TransactionFeed transactions={buffer.items()} />
      </VStack>
    </Box>
  );
}

function AppContent() {
  const data = useNetworkData();

  return (
    <Box minH="100vh" bg="#0d1117">
      <Header
        connected={data.connected}
        lastRefresh={data.lastRefresh}
        fallbackPoll={data.fallbackPoll}
      />

      {data.loading && !data.graph ? (
        <Center h="80vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.400" thickness="3px" />
            <Text color="gray.400">Discovering Cocoon Network contracts…</Text>
            <Text color="gray.600" fontSize="sm">This may take a few seconds</Text>
          </VStack>
        </Center>
      ) : (
        <Routes>
          <Route path="/" element={<Dashboard data={data} error={data.error} />} />
          <Route path="/address/:address" element={<AddressDetail networkData={data.graph} />} />
        </Routes>
      )}

      <Box as="footer" borderTop="1px" borderColor="#30363d" mt={8} py={6} px={8}>
        <HStack justify="center" spacing={2} flexWrap="wrap">
          <Text fontSize="xs" color="gray.500">Built by</Text>
          <Link as={RouterLink} to="/address/UQBKZ9V7mBDva2kQHYXfzcC4LJwtgie1O60xxqke_-vfOM0K"
                color="brand.400" fontSize="xs" fontWeight="medium" _hover={{ color: 'brand.300' }}>
            Agentmeme
          </Link>
          <Text fontSize="xs" color="gray.600" fontFamily="mono">UQBKZ9V7...vfOM0K</Text>
        </HStack>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: succeeds. Fix any import errors (typos, missing deps).

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(App): wire LiveHero, TrendCharts, ActorsPanel, AddressLookup"
```

---

## Task 17: Delete removed components & update env

**Files:**
- Delete: `src/components/StatsCards.jsx`, `src/components/TransactionChart.jsx`, `src/components/SpendBreakdown.jsx`, `src/components/TokenRevenueChart.jsx`, `src/components/SearchInput.jsx`
- Modify: `.env.example`

- [ ] **Step 1: Delete files**

```bash
rm src/components/StatsCards.jsx src/components/TransactionChart.jsx src/components/SpendBreakdown.jsx src/components/TokenRevenueChart.jsx src/components/SearchInput.jsx
```

- [ ] **Step 2: Update `.env.example`**

Replace contents with:

```
TONCENTER_API_KEY=your_toncenter_api_key_here
ROOT_CONTRACT=EQCns7bYSp0igFvS1wpb5wsZjCKCV19MD5AVzI4EyxsnU73k
PORT=3001

# Frontend — optional tonapi.io bearer token for higher SSE rate limits
VITE_TONAPI_TOKEN=
```

- [ ] **Step 3: Build + run tests**

```bash
npm run build && npm test
```

Expected: build succeeds, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -u && git commit -m "chore: remove superseded components; document VITE_TONAPI_TOKEN"
```

---

## Task 18: Add .superpowers/ to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append to `.gitignore`**

```
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers/ brainstorming artifacts"
```

---

## Task 19: Manual verification

**No code changes — verification only.**

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser at http://localhost:5173**

- [ ] **Step 3: Verify each of the following within 30 seconds of load:**

1. Header shows "Stream connected" with green dot (or "Disconnected" with red if SSE is failing — in that case, the "Live stream offline — polling cache" banner should appear)
2. Address search visible above the hero
3. `LiveHero` shows: LIVE pill pulsing, "last tx Ns ago", 4 KPI cards with non-zero rates when window ≠ 1h (may be 0 at 1h window if no activity in last hour — that's expected and correct)
4. Window toggle switches between 1h / 24h / 7d / All — values re-aggregate without a network call (watch Network tab in devtools)
5. `TrendCharts` shows stacked area + donut
6. `ActorsPanel` shows "N/M workers earning (1h)" and "N/M clients spending (1h)" + live feed (may be empty if no 1h activity)
7. `ProxyCards` still renders (should be unchanged)
8. `TransactionFeed` rows show a color-coded type badge (worker payout / client charge / etc.)

- [ ] **Step 4: Verify address lookup**

Paste these into the search and confirm classification:

| Address | Expected |
|---|---|
| `EQCns7bYSp0igFvS1wpb5wsZjCKCV19MD5AVzI4EyxsnU73k` | COCOON · Root |
| Any proxy from ProxyCards grid | COCOON · (Proxy / Cocoon wallet) |
| `UQAverageRandomWalletAddress…` (any non-Cocoon wallet you know) | NOT COCOON · basic facts |
| `garbage` | red "Invalid TON address" error |

- [ ] **Step 5: Verify fallback mode**

Open devtools → Network tab → set throttling to "Offline" for 5 seconds, then back to "Online". The dashboard should:
- Show "Live stream offline — polling cache" banner
- Keep rendering data from the 10s poll (not go blank)
- Reconnect once SSE works again

- [ ] **Step 6: If everything passes, tag the completion commit**

```bash
git commit --allow-empty -m "chore: complete live redesign verification"
```

---

## Summary checklist

After all tasks, verify:

- [ ] All 5 new library files exist with tests that pass: `rateMath.js`, `txClassify.js`, `useLiveFeed.js`, plus tests
- [ ] All 6 new components exist: `Sparkline`, `WindowToggle`, `LiveHero`, `TrendCharts`, `ActorsPanel`, `ResultCard`, `AddressLookup`
- [ ] `useNetworkData.js` exposes `{graph, buffer, bufferVersion, isAlive, lastTxUtime, connected, fallbackPoll, ...}`
- [ ] 5 old components deleted
- [ ] `Header.jsx` no longer contains `SearchInput`
- [ ] `.env.example` documents `VITE_TONAPI_TOKEN`
- [ ] Every headline number in the UI has an explicit label and a window
- [ ] Time-window toggle changes values instantly with no backend call
- [ ] Address lookup returns a verdict card for Cocoon and non-Cocoon addresses
- [ ] Live pulse + "last tx ago" ticker updates as new events stream in
