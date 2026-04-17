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
import NetworkHealth from './components/NetworkHealth';
import LifespanChart from './components/LifespanChart';

function Dashboard({ data, error }) {
  const [windowId, setWindowId] = useState('1h');
  if (!data.graph) return null;
  const { graph, buffer, bufferVersion, isAlive, lastTxUtime } = data;

  return (
    <Box
      px={{ base: 4, md: 6 }}
      py={5}
      maxW="1280px"
      mx="auto"
    >
      <VStack spacing={5} align="stretch">
        {error && (
          <Alert status="warning" variant="subtle" bg="var(--warn-wash)" color="var(--warn)"
                 border="1px solid rgba(245, 158, 11, 0.25)" borderRadius="var(--radius)">
            <AlertIcon color="var(--warn)" />
            <Text fontSize="12.5px">Stale data — {error}</Text>
          </Alert>
        )}

        <NetworkHealth bufferRef={buffer} bufferVersion={bufferVersion} />

        <AddressLookup graph={graph} />

        <LiveHero
          isAlive={isAlive} lastTxUtime={lastTxUtime}
          bufferRef={buffer} bufferVersion={bufferVersion}
          pricePerToken={graph.pricePerToken}
          computeMetricsTotals={graph.computeMetrics?.totals}
          window={windowId} onWindowChange={setWindowId}
        />

        <TrendCharts bufferRef={buffer} bufferVersion={bufferVersion} window={windowId} computeMetrics={graph.computeMetrics} />

        <LifespanChart daily={graph.computeMetrics?.daily} totals={graph.computeMetrics?.totals} />

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
    <Box minH="100vh" color="var(--fg)">
      <Header
        connected={data.connected}
        lastRefresh={data.lastRefresh}
        fallbackPoll={data.fallbackPoll}
      />

      {data.loading && !data.graph ? (
        <Center minH="60vh">
          <VStack spacing={3}>
            <Spinner size="md" color="var(--accent)" thickness="2px" emptyColor="var(--line)" />
            <Text fontSize="13px" color="var(--fg-dim)">
              Discovering network…
            </Text>
          </VStack>
        </Center>
      ) : (
        <Routes>
          <Route path="/" element={<Dashboard data={data} error={data.error} />} />
          <Route path="/address/:address" element={<AddressDetail networkData={data.graph} />} />
        </Routes>
      )}

      <Box as="footer" borderTop="1px solid var(--line-faint)" mt={10} py={6}
           px={{ base: 4, md: 6 }}>
        <Box maxW="1280px" mx="auto">
          <HStack spacing={4} flexWrap="wrap" fontSize="11px" fontFamily="var(--ff-mono)"
                  color="var(--fg-faint)">
            <Text>
              Built by{' '}
              <Link as={RouterLink} to="/address/UQBKZ9V7mBDva2kQHYXfzcC4LJwtgie1O60xxqke_-vfOM0K"
                    color="var(--accent)" _hover={{ color: 'var(--fg)' }}>
                Agentmeme
              </Link>
            </Text>
            <Text>·</Text>
            <Text>Data via toncenter + tonapi</Text>
            <Text>·</Text>
            <Link href="https://github.com/tongateway/cocoon-dashboard" isExternal
                  color="var(--fg-faint)" _hover={{ color: 'var(--fg)' }}>
              github ↗
            </Link>
          </HStack>
        </Box>
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
