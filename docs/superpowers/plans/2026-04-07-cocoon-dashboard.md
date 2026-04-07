# Cocoon Network Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-facing real-time dashboard showing Cocoon Network health — active clients, workers, proxies, transaction flow, and TON spend — pulling data from the TON blockchain via toncenter API.

**Architecture:** Client-only React SPA. Toncenter API is queried directly from the browser with an API key. Contract tree is discovered by analyzing transactions from the root contract outward. Auto-polls every 15s for fresh data.

**Tech Stack:** React 18, Vite, Chakra UI, Recharts, @ton/core, axios

---

## File Structure

```
cocoon-dashboard/
  index.html                    — HTML shell
  vite.config.js                — Vite config
  package.json                  — dependencies
  src/
    main.jsx                    — entry: React root + ChakraProvider
    App.jsx                     — layout orchestration + polling
    theme.js                    — Chakra custom dark theme + colors
    constants.js                — root contract address, API key, intervals
    api/
      toncenter.js              — axios wrapper for toncenter API v2
    lib/
      contractParser.js         — parse root contract BOC → config/proxies
      transactionAnalyzer.js    — classify txs, discover child contracts
      formatters.js             — TON amounts, addresses, timestamps
    hooks/
      useNetworkData.js         — main state + polling + discovery
    components/
      Header.jsx                — branding + live indicator
      StatsCards.jsx             — 4 metric cards
      TransactionChart.jsx       — area chart (recharts)
      SpendBreakdown.jsx         — donut chart
      TransactionFeed.jsx        — scrolling tx table
      ProxyCards.jsx             — proxy topology grid
      AddressCell.jsx            — truncated address + copy
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/theme.js`, `src/constants.js`

- [ ] **Step 1: Initialize Vite React project**

```bash
cd /Users/mac/var/www/cocoon-dashboard
npm create vite@latest . -- --template react
```

Select "React" and "JavaScript" if prompted. If the directory isn't empty, confirm overwrite.

- [ ] **Step 2: Install dependencies**

```bash
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion recharts axios @ton/core buffer
```

- [ ] **Step 3: Create `src/constants.js`**

```js
export const ROOT_CONTRACT = 'EQCns7bYSp0igFvS1wpb5wsZjCKCV19MD5AVzI4EyxsnU73k';
export const TONCENTER_API_KEY = 'e42579162e5b9ad4fd86b1d6436a62057c456a051425ccd2cb13cec143ca1744';
export const TONCENTER_BASE_URL = 'https://toncenter.com/api/v2';
export const POLL_INTERVAL_MS = 15_000;
export const DISCOVERY_INTERVAL_MS = 60_000;
```

- [ ] **Step 4: Create `src/theme.js`**

```js
import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: '#0d1117',
        color: 'gray.100',
      },
    },
  },
  colors: {
    brand: {
      50: '#e6fffa',
      100: '#b2f5ea',
      200: '#81e6d9',
      300: '#4fd1c5',
      400: '#38B2AC',
      500: '#319795',
      600: '#2C7A7B',
      700: '#285E61',
      800: '#234E52',
      900: '#1D4044',
    },
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          bg: '#161b22',
          borderColor: '#30363d',
          borderWidth: '1px',
          borderRadius: 'xl',
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: { borderColor: '#30363d', color: 'gray.400' },
          td: { borderColor: '#30363d' },
        },
      },
    },
  },
});

export default theme;
```

- [ ] **Step 5: Create `src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { Buffer } from 'buffer';
import theme from './theme';
import App from './App';

window.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <App />
    </ChakraProvider>
  </React.StrictMode>
);
```

- [ ] **Step 6: Create placeholder `src/App.jsx`**

```jsx
import { Box, Heading, Text } from '@chakra-ui/react';

export default function App() {
  return (
    <Box minH="100vh" p={8}>
      <Heading color="brand.400">Cocoon Network Dashboard</Heading>
      <Text color="gray.400" mt={2}>Loading...</Text>
    </Box>
  );
}
```

- [ ] **Step 7: Update `index.html`**

Replace the contents of `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cocoon Network Dashboard</title>
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Verify app runs**

```bash
npm run dev
```

Expected: Vite dev server starts, browser shows "Cocoon Network Dashboard" on dark background.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + Chakra UI project"
```

---

### Task 2: Toncenter API Client

**Files:**
- Create: `src/api/toncenter.js`

- [ ] **Step 1: Create `src/api/toncenter.js`**

```js
import axios from 'axios';
import { TONCENTER_BASE_URL, TONCENTER_API_KEY } from '../constants';

const client = axios.create({
  baseURL: TONCENTER_BASE_URL,
  headers: { 'X-API-Key': TONCENTER_API_KEY },
  timeout: 10_000,
});

function unwrap(response) {
  const data = response.data;
  if (!data.ok) throw new Error(data.error || 'Toncenter API error');
  return data.result;
}

export async function getAddressInfo(address) {
  const res = await client.get('/getAddressInformation', { params: { address } });
  return unwrap(res);
}

export async function getBalance(address) {
  const res = await client.get('/getAddressBalance', { params: { address } });
  return unwrap(res);
}

export async function getTransactions(address, limit = 50) {
  const res = await client.get('/getTransactions', { params: { address, limit } });
  return unwrap(res);
}

export async function getWalletInfo(address) {
  const res = await client.get('/getWalletInformation', { params: { address } });
  return unwrap(res);
}

export async function runGetMethod(address, method, stack = []) {
  const res = await client.post('/runGetMethod', { address, method, stack });
  return unwrap(res);
}
```

- [ ] **Step 2: Verify API client works**

Add a temporary test in `src/App.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { Box, Heading, Text, Code } from '@chakra-ui/react';
import { getAddressInfo } from './api/toncenter';
import { ROOT_CONTRACT } from './constants';

export default function App() {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    getAddressInfo(ROOT_CONTRACT).then(info => {
      setBalance((parseInt(info.balance) / 1e9).toFixed(4));
    });
  }, []);

  return (
    <Box minH="100vh" p={8}>
      <Heading color="brand.400">Cocoon Network Dashboard</Heading>
      <Text color="gray.400" mt={2}>
        Root contract balance: <Code colorScheme="teal">{balance ?? '...'} TON</Code>
      </Text>
    </Box>
  );
}
```

Run `npm run dev`, verify the balance shows ~19 TON.

- [ ] **Step 3: Commit**

```bash
git add src/api/toncenter.js src/App.jsx
git commit -m "feat: add toncenter API client"
```

---

### Task 3: Formatters + Address Utilities

**Files:**
- Create: `src/lib/formatters.js`

- [ ] **Step 1: Create `src/lib/formatters.js`**

```js
export function nanoToTon(nano) {
  return parseInt(nano) / 1e9;
}

export function formatTon(nano) {
  const ton = nanoToTon(nano);
  if (ton >= 1_000_000) return (ton / 1_000_000).toFixed(2) + 'M';
  if (ton >= 1_000) return (ton / 1_000).toFixed(2) + 'K';
  if (ton >= 1) return ton.toFixed(2);
  return ton.toFixed(4);
}

export function truncateAddress(address) {
  if (!address || address.length < 12) return address || '';
  return address.slice(0, 6) + '...' + address.slice(-4);
}

export function timeAgo(unixTimestamp) {
  const seconds = Math.floor(Date.now() / 1000) - unixTimestamp;
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDate(unixTimestamp) {
  return new Date(unixTimestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function classifyTransaction(tx, trackedAddresses) {
  const inSource = tx.in_msg?.source || '';
  const inValue = parseInt(tx.in_msg?.value || '0');
  const outMsgs = tx.out_msgs || [];
  const hasBounce = outMsgs.some(m => m.destination === inSource && parseInt(m.value) > 0);

  if (hasBounce) return 'bounce';
  if (outMsgs.length > 0 && inValue === 0) return 'deployment';
  if (outMsgs.length > 0) return 'payment';
  if (inValue > 0) return 'top-up';
  return 'other';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/formatters.js
git commit -m "feat: add formatters and transaction classifier"
```

---

### Task 4: Transaction Analyzer (Contract Discovery)

**Files:**
- Create: `src/lib/transactionAnalyzer.js`

- [ ] **Step 1: Create `src/lib/transactionAnalyzer.js`**

This module traces the contract tree by analyzing transactions from the root outward.

```js
import { getTransactions, getAddressInfo } from '../api/toncenter';

export async function discoverContracts(rootAddress) {
  const discovered = {
    root: { address: rootAddress, balance: '0', state: 'unknown', lastActivity: 0 },
    proxies: new Map(),
    clients: new Map(),
    workers: new Map(),
    allTransactions: [],
  };

  // Phase 1: Get root contract info + transactions
  const [rootInfo, rootTxs] = await Promise.all([
    getAddressInfo(rootAddress),
    getTransactions(rootAddress, 50),
  ]);

  discovered.root.balance = rootInfo.balance;
  discovered.root.state = rootInfo.state;
  discovered.root.lastActivity = rootTxs[0]?.utime || 0;
  discovered.allTransactions.push(
    ...rootTxs.map(tx => ({ ...tx, contractRole: 'root' }))
  );

  // Phase 2: Extract unique interacting addresses from root transactions
  const interactingAddresses = new Set();
  for (const tx of rootTxs) {
    if (tx.in_msg?.source) interactingAddresses.add(tx.in_msg.source);
    for (const outMsg of tx.out_msgs || []) {
      if (outMsg.destination) interactingAddresses.add(outMsg.destination);
    }
  }
  interactingAddresses.delete('');
  interactingAddresses.delete(rootAddress);

  // Phase 3: Check each interacting address — contracts with code are likely proxies
  const addressChecks = await Promise.allSettled(
    [...interactingAddresses].map(async addr => {
      const info = await getAddressInfo(addr);
      return { address: addr, ...info };
    })
  );

  for (const result of addressChecks) {
    if (result.status !== 'fulfilled') continue;
    const info = result.value;
    if (info.state !== 'active' || !info.code) continue;

    // Contracts with code that interact with root are likely proxies
    const balance = parseInt(info.balance);
    discovered.proxies.set(info.address, {
      address: info.address,
      balance: info.balance,
      state: info.state,
      clients: new Map(),
      workers: new Map(),
      lastActivity: 0,
    });
  }

  // Phase 4: For each proxy, fetch transactions to discover clients/workers
  const proxyTxPromises = [...discovered.proxies.keys()].map(async proxyAddr => {
    try {
      const txs = await getTransactions(proxyAddr, 30);
      const proxy = discovered.proxies.get(proxyAddr);
      proxy.lastActivity = txs[0]?.utime || 0;

      discovered.allTransactions.push(
        ...txs.map(tx => ({ ...tx, contractRole: 'proxy' }))
      );

      // Addresses interacting with proxy are clients or workers
      const childAddrs = new Set();
      for (const tx of txs) {
        if (tx.in_msg?.source && tx.in_msg.source !== rootAddress) {
          childAddrs.add(tx.in_msg.source);
        }
        for (const outMsg of tx.out_msgs || []) {
          if (outMsg.destination && outMsg.destination !== rootAddress) {
            childAddrs.add(outMsg.destination);
          }
        }
      }

      const childChecks = await Promise.allSettled(
        [...childAddrs].slice(0, 20).map(async addr => {
          const info = await getAddressInfo(addr);
          return { address: addr, balance: info.balance, state: info.state, hasCode: !!info.code };
        })
      );

      for (const result of childChecks) {
        if (result.status !== 'fulfilled') continue;
        const child = result.value;
        if (child.state !== 'active') continue;

        // Heuristic: contracts with more code are workers, simpler are clients
        // For now, classify all child contracts as clients (simplification)
        if (child.hasCode) {
          // Contracts sending TO proxy = clients (paying for inference)
          // Contracts receiving FROM proxy = workers (getting paid)
          const sendsToProxy = txs.some(tx => tx.in_msg?.source === child.address);
          const receivesFromProxy = txs.some(tx =>
            (tx.out_msgs || []).some(m => m.destination === child.address)
          );

          if (receivesFromProxy && !sendsToProxy) {
            discovered.workers.set(child.address, {
              address: child.address,
              balance: child.balance,
              proxyAddress: proxyAddr,
            });
            proxy.workers.set(child.address, child);
          } else {
            discovered.clients.set(child.address, {
              address: child.address,
              balance: child.balance,
              proxyAddress: proxyAddr,
            });
            proxy.clients.set(child.address, child);
          }
        }
      }
    } catch (err) {
      console.warn(`Failed to analyze proxy ${proxyAddr}:`, err.message);
    }
  });

  await Promise.allSettled(proxyTxPromises);

  // Deduplicate and sort transactions by time
  const txMap = new Map();
  for (const tx of discovered.allTransactions) {
    const key = tx.transaction_id.lt + tx.transaction_id.hash;
    if (!txMap.has(key)) txMap.set(key, tx);
  }
  discovered.allTransactions = [...txMap.values()].sort((a, b) => b.utime - a.utime);

  return discovered;
}

export function aggregateStats(discovered) {
  let totalBalance = parseInt(discovered.root.balance);
  for (const proxy of discovered.proxies.values()) {
    totalBalance += parseInt(proxy.balance);
  }

  let totalTonFlow = 0;
  let totalFees = 0;
  const dailyVolume = {};

  for (const tx of discovered.allTransactions) {
    const inValue = parseInt(tx.in_msg?.value || '0');
    const fee = parseInt(tx.fee || '0');
    totalTonFlow += inValue;
    totalFees += fee;

    const day = new Date(tx.utime * 1000).toISOString().slice(0, 10);
    if (!dailyVolume[day]) dailyVolume[day] = { date: day, volume: 0, txCount: 0, fees: 0 };
    dailyVolume[day].volume += inValue / 1e9;
    dailyVolume[day].txCount += 1;
    dailyVolume[day].fees += fee / 1e9;
  }

  const volumeData = Object.values(dailyVolume).sort((a, b) => a.date.localeCompare(b.date));

  // Spend breakdown
  let workerPayments = 0;
  let proxyFees = 0;
  for (const tx of discovered.allTransactions) {
    if (tx.contractRole === 'proxy') {
      for (const outMsg of tx.out_msgs || []) {
        const dest = outMsg.destination;
        const val = parseInt(outMsg.value || '0');
        if (discovered.workers.has(dest)) {
          workerPayments += val;
        } else {
          proxyFees += val;
        }
      }
    }
  }

  return {
    totalBalance: totalBalance / 1e9,
    proxyCount: discovered.proxies.size,
    clientCount: discovered.clients.size,
    workerCount: discovered.workers.size,
    totalTonFlow: totalTonFlow / 1e9,
    totalFees: totalFees / 1e9,
    volumeData,
    spendBreakdown: [
      { name: 'Worker Payments', value: workerPayments / 1e9 },
      { name: 'Proxy Fees', value: proxyFees / 1e9 },
      { name: 'Network Fees', value: totalFees / 1e9 },
      { name: 'Other', value: Math.max(0, (totalTonFlow - workerPayments - proxyFees) / 1e9) },
    ].filter(s => s.value > 0),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/transactionAnalyzer.js
git commit -m "feat: add transaction analyzer for contract discovery"
```

---

### Task 5: Network Data Hook

**Files:**
- Create: `src/hooks/useNetworkData.js`

- [ ] **Step 1: Create `src/hooks/useNetworkData.js`**

```js
import { useState, useEffect, useCallback, useRef } from 'react';
import { discoverContracts, aggregateStats } from '../lib/transactionAnalyzer';
import { getTransactions } from '../api/toncenter';
import { ROOT_CONTRACT, POLL_INTERVAL_MS, DISCOVERY_INTERVAL_MS } from '../constants';

export function useNetworkData() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const discoveredRef = useRef(null);

  const fullDiscovery = useCallback(async () => {
    try {
      setIsLive(true);
      const discovered = await discoverContracts(ROOT_CONTRACT);
      discoveredRef.current = discovered;
      setData(discovered);
      setStats(aggregateStats(discovered));
      setLastRefresh(new Date());
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Discovery failed:', err);
      setError(err.message);
      setIsLive(false);
    }
  }, []);

  const quickRefresh = useCallback(async () => {
    if (!discoveredRef.current) return;
    try {
      setIsLive(true);
      // Only refresh root transactions and balances
      const rootTxs = await getTransactions(ROOT_CONTRACT, 20);
      const discovered = discoveredRef.current;

      // Merge new transactions
      const txMap = new Map();
      for (const tx of discovered.allTransactions) {
        const key = tx.transaction_id.lt + tx.transaction_id.hash;
        txMap.set(key, tx);
      }
      for (const tx of rootTxs) {
        const key = tx.transaction_id.lt + tx.transaction_id.hash;
        if (!txMap.has(key)) {
          txMap.set(key, { ...tx, contractRole: 'root' });
        }
      }
      discovered.allTransactions = [...txMap.values()].sort((a, b) => b.utime - a.utime);

      setData({ ...discovered });
      setStats(aggregateStats(discovered));
      setLastRefresh(new Date());
    } catch (err) {
      console.warn('Quick refresh failed:', err.message);
    }
  }, []);

  // Initial full discovery
  useEffect(() => {
    fullDiscovery();
  }, [fullDiscovery]);

  // Quick poll every 15s
  useEffect(() => {
    const interval = setInterval(quickRefresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [quickRefresh]);

  // Full discovery every 60s
  useEffect(() => {
    const interval = setInterval(fullDiscovery, DISCOVERY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fullDiscovery]);

  return { data, stats, loading, error, lastRefresh, isLive, refresh: fullDiscovery };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNetworkData.js
git commit -m "feat: add useNetworkData hook with polling"
```

---

### Task 6: AddressCell Component

**Files:**
- Create: `src/components/AddressCell.jsx`

- [ ] **Step 1: Create `src/components/AddressCell.jsx`**

```jsx
import { HStack, Text, IconButton, useClipboard, Tooltip, Link } from '@chakra-ui/react';
import { truncateAddress } from '../lib/formatters';

export default function AddressCell({ address }) {
  const { hasCopied, onCopy } = useClipboard(address || '');
  if (!address) return <Text color="gray.500">—</Text>;

  const tonviewerUrl = `https://tonviewer.com/${address}`;

  return (
    <HStack spacing={1}>
      <Tooltip label={address} placement="top" hasArrow>
        <Link
          href={tonviewerUrl}
          isExternal
          color="brand.300"
          fontFamily="mono"
          fontSize="sm"
          _hover={{ color: 'brand.200' }}
        >
          {truncateAddress(address)}
        </Link>
      </Tooltip>
      <Tooltip label={hasCopied ? 'Copied!' : 'Copy address'} placement="top" hasArrow>
        <IconButton
          icon={<CopyIcon />}
          size="xs"
          variant="ghost"
          color="gray.500"
          _hover={{ color: 'gray.300' }}
          onClick={onCopy}
          aria-label="Copy address"
        />
      </Tooltip>
    </HStack>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AddressCell.jsx
git commit -m "feat: add AddressCell component with copy + tonviewer link"
```

---

### Task 7: Header Component

**Files:**
- Create: `src/components/Header.jsx`

- [ ] **Step 1: Create `src/components/Header.jsx`**

```jsx
import { Box, Flex, Heading, HStack, Text, Badge, IconButton, Tooltip } from '@chakra-ui/react';

export default function Header({ isLive, lastRefresh, onRefresh, loading }) {
  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={8}
      py={4}
      borderBottom="1px"
      borderColor="#30363d"
      bg="#0d1117"
      position="sticky"
      top={0}
      zIndex={10}
    >
      <HStack spacing={4}>
        <CocoonLogo />
        <Box>
          <Heading size="md" color="white" letterSpacing="-0.02em">
            Cocoon Network
          </Heading>
          <Text fontSize="xs" color="gray.500">
            Decentralized AI Inference Dashboard
          </Text>
        </Box>
      </HStack>

      <HStack spacing={4}>
        <HStack spacing={2}>
          <Box
            w={2}
            h={2}
            borderRadius="full"
            bg={isLive ? 'green.400' : 'red.400'}
            boxShadow={isLive ? '0 0 8px rgba(72,187,120,0.6)' : 'none'}
          />
          <Text fontSize="sm" color={isLive ? 'green.400' : 'red.400'}>
            {isLive ? 'Live' : 'Offline'}
          </Text>
        </HStack>

        {lastRefresh && (
          <Text fontSize="xs" color="gray.500">
            Updated {lastRefresh.toLocaleTimeString()}
          </Text>
        )}

        <Tooltip label="Refresh now" hasArrow>
          <IconButton
            icon={<RefreshIcon />}
            size="sm"
            variant="ghost"
            color="gray.400"
            _hover={{ color: 'white' }}
            onClick={onRefresh}
            isLoading={loading}
            aria-label="Refresh"
          />
        </Tooltip>
      </HStack>
    </Flex>
  );
}

function CocoonLogo() {
  return (
    <Box
      w={10}
      h={10}
      borderRadius="lg"
      bg="brand.400"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    </Box>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.jsx
git commit -m "feat: add Header component with live indicator"
```

---

### Task 8: Stats Cards Component

**Files:**
- Create: `src/components/StatsCards.jsx`

- [ ] **Step 1: Create `src/components/StatsCards.jsx`**

```jsx
import { SimpleGrid, Card, CardBody, Stat, StatLabel, StatNumber, StatHelpText, Icon, Flex, Box } from '@chakra-ui/react';
import { formatTon } from '../lib/formatters';

const cards = [
  {
    key: 'totalBalance',
    label: 'Network Balance',
    format: v => `${v.toFixed(2)} TON`,
    icon: WalletIcon,
    color: 'teal.400',
  },
  {
    key: 'proxyCount',
    label: 'Active Proxies',
    format: v => String(v),
    icon: ServerIcon,
    color: 'purple.400',
  },
  {
    key: 'clientCount',
    label: 'Active Clients',
    format: v => String(v),
    icon: UsersIcon,
    color: 'cyan.400',
  },
  {
    key: 'workerCount',
    label: 'Active Workers',
    format: v => String(v),
    icon: CpuIcon,
    color: 'orange.400',
  },
];

export default function StatsCards({ stats }) {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
      {cards.map(card => (
        <Card key={card.key} overflow="hidden">
          <CardBody>
            <Flex justify="space-between" align="flex-start">
              <Stat>
                <StatLabel color="gray.400" fontSize="sm">{card.label}</StatLabel>
                <StatNumber color="white" fontSize="2xl" mt={1}>
                  {stats ? card.format(stats[card.key]) : '—'}
                </StatNumber>
                <StatHelpText color="gray.500" fontSize="xs" mb={0}>
                  {card.key === 'totalBalance' && stats
                    ? `${stats.totalTonFlow.toFixed(2)} TON total flow`
                    : '\u00A0'}
                </StatHelpText>
              </Stat>
              <Box p={2} borderRadius="lg" bg="whiteAlpha.50">
                <card.icon color={card.color} />
              </Box>
            </Flex>
          </CardBody>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function WalletIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

function ServerIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function UsersIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function CpuIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StatsCards.jsx
git commit -m "feat: add StatsCards component"
```

---

### Task 9: Transaction Volume Chart

**Files:**
- Create: `src/components/TransactionChart.jsx`

- [ ] **Step 1: Create `src/components/TransactionChart.jsx`**

```jsx
import { Card, CardBody, CardHeader, Heading, ButtonGroup, Button, Box, Text } from '@chakra-ui/react';
import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: 'All', days: Infinity },
];

export default function TransactionChart({ volumeData }) {
  const [period, setPeriod] = useState(30);

  const filteredData = useMemo(() => {
    if (!volumeData || volumeData.length === 0) return [];
    if (period === Infinity) return volumeData;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return volumeData.filter(d => d.date >= cutoffStr);
  }, [volumeData, period]);

  return (
    <Card>
      <CardHeader pb={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Heading size="sm" color="white">Transaction Volume</Heading>
          <ButtonGroup size="xs" variant="outline">
            {PERIODS.map(p => (
              <Button
                key={p.label}
                onClick={() => setPeriod(p.days)}
                colorScheme={period === p.days ? 'teal' : 'gray'}
                variant={period === p.days ? 'solid' : 'outline'}
              >
                {p.label}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
      </CardHeader>
      <CardBody>
        {filteredData.length === 0 ? (
          <Box h="250px" display="flex" alignItems="center" justifyContent="center">
            <Text color="gray.500">No transaction data yet</Text>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={filteredData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38B2AC" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38B2AC" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis
                dataKey="date"
                tickFormatter={d => d.slice(5)}
                stroke="#484f58"
                fontSize={11}
              />
              <YAxis stroke="#484f58" fontSize={11} tickFormatter={v => `${v.toFixed(1)}`} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                labelStyle={{ color: '#8b949e' }}
                itemStyle={{ color: '#38B2AC' }}
                formatter={(value) => [`${value.toFixed(4)} TON`, 'Volume']}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#38B2AC"
                strokeWidth={2}
                fill="url(#volumeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TransactionChart.jsx
git commit -m "feat: add TransactionChart with area chart and time toggle"
```

---

### Task 10: Spend Breakdown Chart

**Files:**
- Create: `src/components/SpendBreakdown.jsx`

- [ ] **Step 1: Create `src/components/SpendBreakdown.jsx`**

```jsx
import { Card, CardBody, CardHeader, Heading, Box, HStack, VStack, Text } from '@chakra-ui/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#38B2AC', '#805AD5', '#DD6B20', '#4299E1'];

export default function SpendBreakdown({ data }) {
  const hasData = data && data.length > 0 && data.some(d => d.value > 0);

  return (
    <Card>
      <CardHeader pb={0}>
        <Heading size="sm" color="white">TON Spend Breakdown</Heading>
      </CardHeader>
      <CardBody>
        {!hasData ? (
          <Box h="250px" display="flex" alignItems="center" justifyContent="center">
            <Text color="gray.500">No spend data yet</Text>
          </Box>
        ) : (
          <HStack spacing={4} align="center">
            <ResponsiveContainer width="60%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, idx) => (
                    <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                  formatter={(value) => [`${value.toFixed(4)} TON`]}
                />
              </PieChart>
            </ResponsiveContainer>
            <VStack spacing={3} align="start" flex={1}>
              {data.map((entry, idx) => (
                <HStack key={entry.name} spacing={2}>
                  <Box w={3} h={3} borderRadius="sm" bg={COLORS[idx % COLORS.length]} />
                  <VStack spacing={0} align="start">
                    <Text fontSize="xs" color="gray.400">{entry.name}</Text>
                    <Text fontSize="sm" color="white" fontWeight="bold">
                      {entry.value.toFixed(4)} TON
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>
          </HStack>
        )}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SpendBreakdown.jsx
git commit -m "feat: add SpendBreakdown donut chart"
```

---

### Task 11: Live Transaction Feed

**Files:**
- Create: `src/components/TransactionFeed.jsx`

- [ ] **Step 1: Create `src/components/TransactionFeed.jsx`**

```jsx
import {
  Card, CardBody, CardHeader, Heading,
  Table, Thead, Tbody, Tr, Th, Td,
  Badge, Text, Box, HStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import AddressCell from './AddressCell';
import { timeAgo, nanoToTon, classifyTransaction } from '../lib/formatters';

const TYPE_COLORS = {
  payment: 'teal',
  'top-up': 'green',
  withdrawal: 'orange',
  deployment: 'purple',
  bounce: 'red',
  other: 'gray',
};

export default function TransactionFeed({ transactions }) {
  const displayTxs = useMemo(() => {
    return (transactions || []).slice(0, 50);
  }, [transactions]);

  return (
    <Card>
      <CardHeader pb={0}>
        <HStack justify="space-between">
          <Heading size="sm" color="white">Live Transactions</Heading>
          <HStack spacing={1}>
            <Box w={2} h={2} borderRadius="full" bg="green.400"
              animation="pulse 2s infinite"
              sx={{ '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }}
            />
            <Text fontSize="xs" color="gray.500">{displayTxs.length} recent</Text>
          </HStack>
        </HStack>
      </CardHeader>
      <CardBody overflowX="auto">
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Time</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th isNumeric>Amount</Th>
              <Th>Type</Th>
              <Th isNumeric>Fee</Th>
            </Tr>
          </Thead>
          <Tbody>
            {displayTxs.length === 0 ? (
              <Tr>
                <Td colSpan={6} textAlign="center" color="gray.500" py={8}>
                  No transactions found
                </Td>
              </Tr>
            ) : (
              displayTxs.map((tx, i) => {
                const inValue = parseInt(tx.in_msg?.value || '0');
                const fee = parseInt(tx.fee || '0');
                const txType = classifyTransaction(tx);

                return (
                  <Tr key={tx.transaction_id.lt + '-' + i} _hover={{ bg: 'whiteAlpha.50' }}>
                    <Td>
                      <Text fontSize="xs" color="gray.400" whiteSpace="nowrap">
                        {timeAgo(tx.utime)}
                      </Text>
                    </Td>
                    <Td><AddressCell address={tx.in_msg?.source} /></Td>
                    <Td><AddressCell address={tx.in_msg?.destination || tx.address?.account_address} /></Td>
                    <Td isNumeric>
                      <Text fontSize="sm" color={inValue > 0 ? 'green.300' : 'gray.500'} fontFamily="mono">
                        {inValue > 0 ? `+${nanoToTon(inValue).toFixed(4)}` : '0'}
                      </Text>
                    </Td>
                    <Td>
                      <Badge colorScheme={TYPE_COLORS[txType]} variant="subtle" fontSize="xs">
                        {txType}
                      </Badge>
                    </Td>
                    <Td isNumeric>
                      <Text fontSize="xs" color="gray.500" fontFamily="mono">
                        {nanoToTon(fee).toFixed(4)}
                      </Text>
                    </Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TransactionFeed.jsx
git commit -m "feat: add TransactionFeed live table"
```

---

### Task 12: Proxy Cards (Network Topology)

**Files:**
- Create: `src/components/ProxyCards.jsx`

- [ ] **Step 1: Create `src/components/ProxyCards.jsx`**

```jsx
import {
  Card, CardBody, CardHeader, Heading,
  SimpleGrid, Box, HStack, VStack, Text, Badge,
} from '@chakra-ui/react';
import AddressCell from './AddressCell';
import { nanoToTon, timeAgo } from '../lib/formatters';

export default function ProxyCards({ proxies }) {
  const proxyList = proxies ? [...proxies.values()] : [];

  return (
    <Card>
      <CardHeader pb={2}>
        <Heading size="sm" color="white">Network Topology</Heading>
      </CardHeader>
      <CardBody>
        {proxyList.length === 0 ? (
          <Box py={8} textAlign="center">
            <Text color="gray.500">Discovering proxies...</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
            {proxyList.map(proxy => (
              <Box
                key={proxy.address}
                p={4}
                borderRadius="lg"
                border="1px"
                borderColor="#30363d"
                bg="#0d1117"
                _hover={{ borderColor: 'brand.600' }}
                transition="border-color 0.2s"
              >
                <HStack justify="space-between" mb={3}>
                  <Badge colorScheme={proxy.state === 'active' ? 'green' : 'red'} variant="subtle">
                    {proxy.state}
                  </Badge>
                  <Text fontSize="xs" color="gray.500">
                    {proxy.lastActivity ? timeAgo(proxy.lastActivity) : 'unknown'}
                  </Text>
                </HStack>

                <AddressCell address={proxy.address} />

                <HStack mt={3} spacing={4}>
                  <VStack spacing={0} align="start">
                    <Text fontSize="xs" color="gray.500">Balance</Text>
                    <Text fontSize="sm" color="white" fontWeight="bold">
                      {nanoToTon(proxy.balance).toFixed(2)} TON
                    </Text>
                  </VStack>
                  <VStack spacing={0} align="start">
                    <Text fontSize="xs" color="gray.500">Clients</Text>
                    <Text fontSize="sm" color="cyan.400" fontWeight="bold">
                      {proxy.clients?.size || 0}
                    </Text>
                  </VStack>
                  <VStack spacing={0} align="start">
                    <Text fontSize="xs" color="gray.500">Workers</Text>
                    <Text fontSize="sm" color="orange.400" fontWeight="bold">
                      {proxy.workers?.size || 0}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProxyCards.jsx
git commit -m "feat: add ProxyCards network topology grid"
```

---

### Task 13: Full App Integration

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace `src/App.jsx` with full integrated layout**

```jsx
import { Box, VStack, Grid, GridItem, Spinner, Center, Text, Alert, AlertIcon } from '@chakra-ui/react';
import { useNetworkData } from './hooks/useNetworkData';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import TransactionChart from './components/TransactionChart';
import SpendBreakdown from './components/SpendBreakdown';
import TransactionFeed from './components/TransactionFeed';
import ProxyCards from './components/ProxyCards';

export default function App() {
  const { data, stats, loading, error, lastRefresh, isLive, refresh } = useNetworkData();

  if (loading && !data) {
    return (
      <Box minH="100vh" bg="#0d1117">
        <Header isLive={false} lastRefresh={null} onRefresh={refresh} loading={true} />
        <Center h="80vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.400" thickness="3px" />
            <Text color="gray.400">Discovering Cocoon Network contracts...</Text>
            <Text color="gray.600" fontSize="sm">This may take a few seconds</Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="#0d1117">
      <Header isLive={isLive} lastRefresh={lastRefresh} onRefresh={refresh} loading={loading} />

      <Box px={{ base: 4, lg: 8 }} py={6} maxW="1400px" mx="auto">
        <VStack spacing={6} align="stretch">
          {error && (
            <Alert status="warning" variant="subtle" borderRadius="lg" bg="orange.900" color="orange.200">
              <AlertIcon />
              Data may be stale: {error}
            </Alert>
          )}

          <StatsCards stats={stats} />

          <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap={6}>
            <GridItem>
              <TransactionChart volumeData={stats?.volumeData} />
            </GridItem>
            <GridItem>
              <SpendBreakdown data={stats?.spendBreakdown} />
            </GridItem>
          </Grid>

          <ProxyCards proxies={data?.proxies} />

          <TransactionFeed transactions={data?.allTransactions} />
        </VStack>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Clean up default Vite files**

Delete `src/App.css`, `src/index.css`, and the default `public/vite.svg` if they exist. Remove any CSS import from `src/main.jsx` if present.

- [ ] **Step 3: Run the app and verify**

```bash
npm run dev
```

Expected: Full dashboard loads with dark theme. After a few seconds, stats cards populate, transactions appear, proxy cards show discovered contracts.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: integrate all components into App layout"
```

---

### Task 14: Polish + Vite Config + Buffer Polyfill

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Update `vite.config.js` for @ton/core compatibility**

`@ton/core` uses Node.js `Buffer` which needs a polyfill in the browser. Update `vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
});
```

- [ ] **Step 2: Verify everything works end-to-end**

```bash
npm run dev
```

Open in browser. Verify:
1. Dark theme renders correctly
2. Header shows "Live" with green dot after data loads
3. Stats cards show non-zero values for balance
4. Transaction chart shows data points
5. Transaction feed scrolls with recent transactions
6. Proxy cards show at least one discovered proxy

- [ ] **Step 3: Build for production**

```bash
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish vite config and buffer polyfill"
```
