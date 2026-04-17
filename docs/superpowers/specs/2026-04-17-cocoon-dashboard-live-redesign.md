# Cocoon Dashboard — Live Redesign Spec

**Date:** 2026-04-17
**Status:** Approved (pending user review of this doc)
**Supersedes:** [2026-04-07-cocoon-dashboard-design.md](2026-04-07-cocoon-dashboard-design.md) (visual and data-flow sections only — the contract classification logic in the Cloudflare Worker is kept)

## Problem

The current dashboard feels dead: viewers can't tell whether the Cocoon Network is alive and healthy, and the headline numbers (commission, tokens, worker/client counts) are unlabeled or ambiguous. Three concrete pains:

1. Data refreshes on a 5–10 minute KV cache → no sense of live activity.
2. Numbers are cumulative all-time totals with unclear definitions → "is 38 TON good or bad?"
3. No way for a visitor to check whether a given TON address is part of Cocoon.

## Goals

1. A viewer opening the dashboard cold can answer in 2 seconds: **"Is the network alive right now?"** and **"Is it earning?"**
2. Every headline number has an explicit definition (label + sublabel) and a time window.
3. An address pasted into the top-bar search returns an inline verdict: *Cocoon role + relationship* or *Not Cocoon*.
4. The "live" feel comes from events streaming in, not from polling ticks.

## Non-Goals

- No historical analytics beyond "all time" totals. Time-series charts show the selected window only.
- No wallet/auth. Read-only public dashboard.
- No trade execution or on-chain actions.
- No redesign of the per-address detail page (`/address/:addr`) — keep as-is.

## Definitions (authoritative — used throughout UI and code)

| Term | Definition | Computed from |
|---|---|---|
| **Compute spend** | TON clients pay per inference request | in-msg value where `op = client_proxy_request` (to proxy) + `op = ext_client_charge_signed` (to client) |
| **Worker revenue** | TON workers receive as payout | in-msg value where `op = ext_worker_payout_signed` (to worker) |
| **Network commission** | Compute spend − Worker revenue | derived |
| **Tokens processed** | Compute spend ÷ `price_per_token` | `price_per_token` read from root config (currently 20 nanoTON base) |
| **Active worker** | Worker that received `ext_worker_payout_signed` in the last 1 hour (fixed — does *not* follow the window toggle) | always 1h window |
| **Active client** | Client that sent a charge (`client_proxy_request` or `ext_client_charge_signed`) in the last 1 hour (fixed) | always 1h window |
| **Last tx** | Most recent transaction on any tracked contract | max `utime` across stream + cache |
| **Network alive** | `last tx < 5 minutes ago` AND ≥ 1 proxy in active state | composite |

Commission take-rate (displayed as percentage) = commission / compute spend × 100.

## Architecture

**Hybrid: Cloudflare Worker for the graph snapshot, browser SSE for live events.**

```
┌──────────────────────────────┐         ┌──────────────────────┐
│  Cloudflare Worker (existing)│         │   tonapi.io (SSE)    │
│  - discovery crawl (cron)    │         │   /v2/sse/accounts/  │
│  - classifyByCode + BFS      │         │   transactions       │
│  - /api/discover → graph     │         └──────────┬───────────┘
│  - /api/account-type/:addr   │                    │ streamed tx events
│  - /api/analysis/:addr       │                    │
└──────────────┬───────────────┘                    │
               │ graph snapshot (2 min stale ok)    │
               ▼                                    ▼
        ┌──────────────────────────────────────────────┐
        │            React app (browser)               │
        │  - seeds graph from worker on load           │
        │  - opens SSE for root + all discovered       │
        │    proxies (resubscribes when graph updates) │
        │  - merges streamed txs into rolling buffer   │
        │  - all rate KPIs computed client-side from   │
        │    the buffer (1h/24h/7d/all windows)        │
        │  - fallback: poll /api/discover if SSE drops │
        └──────────────────────────────────────────────┘
```

**Why hybrid:**
- The worker's discovery crawl (opcode tracing + code-hash classification) is the hard part; it's already correct. Keep it.
- SSE gives us sub-second transaction updates — the actual source of "live feel."
- Rate math moves to the client: the window toggle becomes instant, no backend round-trip.

## Components (React, files under `src/`)

### New / rewritten

- **`hooks/useLiveFeed.js`** — opens SSE to tonapi, manages reconnect/backoff, exposes a rolling buffer of the last ~2000 txs with helpers `txsInWindow(ms)` and `subscribe(addrs)`. Auto-resubscribes when `addrs` changes (new proxies discovered).
- **`hooks/useNetworkData.js`** *(rewrite)* — still fetches `/api/discover` for the graph, but now exposes `{ graph, feed, stats(window), isAlive, lastTxAgo }`. `stats(window)` is a pure function over `feed` + `graph`, so UI re-renders on buffer change.
- **`lib/rateMath.js`** — pure functions: `computeSpend(txs)`, `workerRevenue(txs)`, `commission(txs)`, `tokensProcessed(txs, pricePerToken)`, `activeActors(txs, kind)`. All take a tx array, classify by opcode, return aggregated number. Unit-testable.
- **`lib/opcodes.js`** *(reuse)* — already parses opcodes from msg bodies.
- **`components/LiveHero.jsx`** — replaces `StatsCards`. Renders the LIVE pill, last-tx ticker, 4 rate KPIs each with 24h mini-sparkline, and the window toggle (1h/24h/7d/all). Window state is lifted to parent.
- **`components/TrendCharts.jsx`** — replaces current `TransactionChart` + `SpendBreakdown`. Renders stacked area (compute vs worker payouts) + commission donut side-by-side. Reads from `feed` via `rateMath`.
- **`components/ActorsPanel.jsx`** — "14 of 18 workers earning · 31 of 47 clients spending" + live event feed (last ~10 events from the buffer, each tagged with a color pill for opcode type).
- **`components/AddressLookup.jsx`** — top-bar search (replaces current `SearchInput`). Paste address → calls `/api/account-type/:addr`, renders inline result card *above* `LiveHero` with role pill, relationship copy, 4 key facts, and action buttons (View details → / Copy / Tonviewer). Dismissible. Shows "Not Cocoon" state for external addresses.
- **`components/ResultCard.jsx`** — the inline verdict card used by `AddressLookup`. Variants: `cocoon` (green border, ✓ icon) vs `outside` (neutral border, ? icon).

### Kept as-is

- `components/ProxyCards.jsx` (already filters to cocoon_wallet per commit `50ec2b3`)
- `components/TransactionFeed.jsx` (just needs opcode-classified badges — small change)
- `pages/AddressDetail.jsx`
- `api/backend.js`, `api/toncenter.js`
- `worker/*` (no code changes; scheduled crawl interval may change from current to every 2 min)

### Removed

- `components/TokenRevenueChart.jsx` — its info folds into `TrendCharts` and the hero KPIs.

## Data Flow

1. **On mount:** `useNetworkData` calls `/api/discover` → gets `{ root, proxies, clients, workers, cocoonWallets, transactions }`. Seeds the rolling tx buffer with the ~1000 most recent txs from the cache.
2. **Live subscription:** `useLiveFeed` opens SSE to `https://tonapi.io/v2/sse/accounts/transactions?accounts=<root>,<proxy1>,<proxy2>,...`. On each event, fetches the full tx details (tonapi `GET /v2/blockchain/accounts/:addr/transactions?limit=1` keyed by `tx_hash`), classifies by opcode, pushes into the buffer.
3. **Rate computation:** `LiveHero` subscribes to `{ feed, window }`. On every buffer change, `rateMath.computeSpend(feed.txsInWindow(window))` runs. Cheap — buffer is bounded at 2000 items.
4. **Window toggle:** user clicks 1h → parent `window` state updates → `LiveHero` and `TrendCharts` both re-render with new aggregation. No network call.
5. **Graph refresh:** every 2 min, `/api/discover` re-polled in background. If new proxies appear, `useLiveFeed` resubscribes with updated address list.
6. **Address lookup:** user pastes address → `AddressLookup` calls `/api/account-type/:addr`. Response includes `{ interfaces, type, balance, state, opcodes }`. If `type` starts with `cocoon_`, we also look up relationship from the graph (`"registered by root X"` for proxies, `"serves proxy Y"` for clients/workers).

## SSE + Fallback

- SSE endpoint: tonapi.io `/v2/sse/accounts/transactions?accounts=<csv>` (public; token via `Authorization: Bearer` header if `VITE_TONAPI_TOKEN` is set).
- Reconnect: exponential backoff (1s → 2 → 4 → 8 → max 30s), reset on successful message.
- **Fallback:** if SSE fails 3 times consecutively, switch to polling `/api/discover` every 10s and emit a subtle banner "Live stream offline — showing cached data (updates every 10s)."

## Visual Design

Per `full-layout.html` mockup (see `.superpowers/brainstorm/`). Key specs:

- **Dark theme:** bg `#0d1117`, cards `#161b22`, borders `#30363d`, green accent `#3fb950`, blue `#58a6ff`, amber `#d29922`, purple `#a371f7`.
- **LIVE pill:** pulsing green dot, small uppercase text, visible whenever last tx < 5 min.
- **Rate KPIs:** label (10pt uppercase gray), value (22pt, unit suffix in 12pt gray), sub (11pt with delta arrow), 24h mini-sparkline (svg, no library).
- **Window toggle:** 4 pill buttons (1h / 24h / 7d / all) — drives both `LiveHero` rates and `TrendCharts`.
- **Address lookup result:** appears above `LiveHero`, dismissible with ✕. Green-tinted border for Cocoon, neutral for Not-Cocoon.

## Error Handling

- **Graph fetch fails:** show stale cache if available, banner "Graph data unavailable — showing last known state (Xm ago)."
- **SSE fails:** see Fallback above.
- **Address lookup fails:** inline error in result card "Couldn't resolve address: <error>." Retry button.
- **Invalid address format:** client-side validation using `@ton/core` `Address.parse`. Show red outline + "Invalid TON address."

## Performance

- Tx buffer capped at 2000 entries (circular). Older txs dropped — "all time" window reads from `graph.computeMetrics.totals` (already computed by the worker in `worker/src/discovery.js`), not from the buffer. For 1h / 24h / 7d windows, rates are computed from the buffer (for 7d we seed the buffer with the last 7 days of txs from the discovery cache on load).
- Rate math memoized per `(windowMs, bufferVersion)` — buffer version bumps on push.
- Sparklines use raw SVG paths, not recharts, to avoid re-layout cost on every tick.
- `AddressLookup` debounces input by 300ms; only fires API call on submit (Enter or button), not keystroke.

## Testing

- `lib/rateMath.test.js` — unit tests for all aggregation functions with fixture txs (spend, revenue, commission, tokens at default pricePerToken).
- `hooks/useLiveFeed.test.js` — mock EventSource; verify reconnect logic, buffer circularity, resubscribe on address-set change.
- Manual: with worker staging endpoint, open dashboard, verify: rate KPIs > 0 within 10s, event feed scrolls as txs arrive, window toggle re-aggregates without flicker, address lookup returns correct role for known proxy/client/worker/wallet.

## Environment Variables

| Var | Used by | Notes |
|---|---|---|
| `VITE_API_URL` | frontend | Worker URL, already in use |
| `VITE_TONAPI_TOKEN` | frontend (optional) | Bearer token for SSE; anonymous fallback if absent |
| `TONCENTER_API_KEY` | worker | already set in wrangler |

## Out of Scope (explicitly)

- Changes to worker discovery crawl logic
- Changes to `/address/:addr` page layout
- Jetton / NFT tracking
- Any on-chain action (deploy, transfer, etc.)

## Open Questions (none — resolved in brainstorming)

- ~~Should window toggle affect hero + trends together?~~ → Yes, single shared window control.
- ~~Classifications: add "related wallet"?~~ → No, keep 6: Root / Proxy / Client / Worker / Cocoon wallet / Not Cocoon.
