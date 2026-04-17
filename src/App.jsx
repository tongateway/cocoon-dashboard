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
      px={{ base: 5, md: 10, lg: 14 }}
      py={{ base: 6, md: 10 }}
      maxW="1360px"
      mx="auto"
    >
      <VStack spacing={{ base: 10, md: 14 }} align="stretch">
        {error && (
          <Alert
            status="warning"
            variant="subtle"
            bg="rgba(245, 139, 124, 0.06)"
            color="var(--coral)"
            borderRadius="2px"
            border="1px solid rgba(245, 139, 124, 0.3)"
            fontFamily="var(--ff-display)"
            fontStyle="italic"
            sx={{ fontVariationSettings: '"opsz" 16, "SOFT" 80' }}
          >
            <AlertIcon color="var(--coral)" />
            Data may be stale — {error}
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
    <Box minH="100vh" color="var(--ink-high)" position="relative">
      <Header
        connected={data.connected}
        lastRefresh={data.lastRefresh}
        fallbackPoll={data.fallbackPoll}
      />

      {data.loading && !data.graph ? (
        <Center minH="70vh">
          <VStack spacing={5}>
            <Spinner size="lg" color="var(--honey)" thickness="2px" emptyColor="var(--line)" />
            <Text
              fontFamily="var(--ff-display)"
              fontStyle="italic"
              fontSize="18px"
              color="var(--ink-mid)"
              sx={{ fontVariationSettings: '"opsz" 20, "SOFT" 80' }}
            >
              discovering the network…
            </Text>
            <Text fontSize="11px" color="var(--ink-faint)" fontFamily="var(--ff-mono)" letterSpacing="0.18em" textTransform="uppercase">
              crawling root · classifying contracts
            </Text>
          </VStack>
        </Center>
      ) : (
        <Routes>
          <Route path="/" element={<Dashboard data={data} error={data.error} />} />
          <Route path="/address/:address" element={<AddressDetail networkData={data.graph} />} />
        </Routes>
      )}

      {/* Editorial colophon footer */}
      <Box
        as="footer"
        borderTop="1px solid var(--line-faint)"
        mt={16}
        py={10}
        px={{ base: 5, md: 10 }}
      >
        <Box maxW="1360px" mx="auto">
          <Text
            fontFamily="var(--ff-display)"
            fontStyle="italic"
            fontSize="14px"
            color="var(--ink-low)"
            mb={3}
            sx={{ fontVariationSettings: '"opsz" 16, "SOFT" 80' }}
          >
            Colophon
          </Text>
          <HStack spacing={6} flexWrap="wrap" fontSize="11px" fontFamily="var(--ff-mono)"
                  color="var(--ink-faint)" letterSpacing="0.12em" textTransform="uppercase">
            <Text>Built by{' '}
              <Link as={RouterLink} to="/address/UQBKZ9V7mBDva2kQHYXfzcC4LJwtgie1O60xxqke_-vfOM0K"
                    color="var(--honey)" _hover={{ color: 'var(--ink-high)' }}>
                Agentmeme
              </Link>
            </Text>
            <Text>Data · TON mainnet via toncenter + tonapi</Text>
            <Text>Typeset in Fraunces & Geist</Text>
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
