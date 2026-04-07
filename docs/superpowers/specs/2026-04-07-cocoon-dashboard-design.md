# Cocoon Network Dashboard — Design Spec

## Overview

Public-facing dashboard for the Cocoon Network, a decentralized AI inference platform on the TON blockchain. Displays real-time network health: active clients, workers, proxies, transaction flow, and TON spend.

## Root Contract

`EQCns7bYSp0igFvS1wpb5wsZjCKCV19MD5AVzI4EyxsnU73k` — the primary Cocoon root contract on TON mainnet (~19 TON balance). Stores proxy list, allowed image/model hashes, config params (price_per_token, worker_fee_per_token, delays, stakes).

## Data Sources

**Toncenter API v2** with key `e42579162e5b9ad4fd86b1d6436a62057c456a051425ccd2cb13cec143ca1744`

### What we can extract:

1. **Root contract state** (`getAddressInformation`) — raw BOC data parsed with `@ton/core` to get:
   - Proxy addresses and IPs
   - Accepted proxy/worker/model hashes
   - Config: price_per_token, worker_fee_per_token, multipliers, delays, min stakes
   - Proxy/client/worker smart contract code references

2. **Transaction history** (`getTransactions`) — for root + all discovered proxy contracts:
   - Source/destination addresses
   - Values, fees, timestamps
   - Message bodies (operation types)
   - Used to discover client/worker contracts and track payment flows

3. **Balance queries** (`getAddressBalance`) — for all tracked contracts

4. **Contract state** (`getAddressInformation`) — active/frozen/uninitialized for each contract

### Deep crawl strategy:
- Root → extract proxy list from BOC data
- Each proxy → fetch transactions → identify client/worker contract addresses (deployed as child contracts)
- Each client/worker → fetch balance and last activity
- Cache discovered addresses, refresh every 60s for the tree, 15s for balances/transactions

## Tech Stack

- React 18 + Vite
- Chakra UI (`@chakra-ui/react`)
- Recharts (charts)
- `@ton/core` (BOC/Cell parsing)
- axios (HTTP)
- Auto-polling: 15s for transactions/balances, 60s for contract tree discovery

## Dashboard Layout

### 1. Header
- Cocoon Network logo/title
- Live pulse indicator (green dot when polling active)
- Last refresh timestamp
- Dark theme (dark background, accent colors matching Cocoon brand)

### 2. Stats Cards (top row, 4 cards)
- **Network Balance**: Sum of root + all proxy contract balances in TON
- **Active Proxies**: Count of proxy contracts in active state
- **Active Clients**: Count of discovered client contracts
- **Active Workers**: Count of discovered worker contracts

### 3. Transaction Volume Chart
- Area/line chart showing TON flow over time
- Grouped by day
- Toggle: 7d / 30d / all time
- Data: aggregated from all tracked contract transactions

### 4. TON Spend Breakdown
- Donut/pie chart
- Segments: Worker payments, Proxy fees, Storage fees, Other
- Derived from transaction analysis (out_msgs from proxies → workers = worker payments, fees from tx metadata)

### 5. Live Transaction Feed
- Table with columns: Time (relative), From, To, Amount (TON), Type, Status
- From/To show truncated addresses with copy button
- Type labels: Payment, Top-up, Withdrawal, Deployment, Bounce
- Auto-scrolls as new transactions appear
- Max 50 visible rows, paginated

### 6. Network Topology / Proxy Cards
- Grid of cards, one per proxy
- Each shows: proxy address (truncated), balance, client count, worker count, last activity time
- Color-coded status indicator

## Color Scheme / Dark Theme
- Background: dark gray (#0d1117 / gray.900)
- Cards: slightly lighter (#161b22 / gray.800)
- Accent: Cocoon green/teal (#38B2AC or teal.400)
- Text: white/gray.100
- Secondary text: gray.400
- Chart colors: teal, cyan, purple gradients

## File Structure

```
src/
  main.jsx              — entry point, ChakraProvider setup
  App.jsx               — main layout, polling orchestration
  theme.js              — Chakra custom theme (dark mode)
  api/
    toncenter.js        — toncenter API client (axios wrapper)
    contractParser.js   — BOC parsing with @ton/core
  hooks/
    useNetworkData.js   — main data hook (polling, state management)
  components/
    Header.jsx          — top bar with branding + status
    StatsCards.jsx      — 4 metric cards
    TransactionChart.jsx — recharts area chart
    SpendBreakdown.jsx  — donut chart
    TransactionFeed.jsx — live transaction table
    ProxyCards.jsx      — network topology grid
    AddressCell.jsx     — truncated address with copy
```

## Error Handling
- API failures: show last known data with "stale" indicator
- Rate limiting: exponential backoff on 429s
- Network offline: banner at top

## Performance
- Memoize parsed contract data
- Only re-fetch changed data (compare last_transaction_id)
- Virtualize transaction feed if >100 rows
