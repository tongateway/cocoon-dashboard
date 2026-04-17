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
    <Box px={{ base: 4, lg: 8 }} py={6} maxW="1400px" mx="auto">
      <VStack spacing={6} align="stretch">
        {error && (
          <Alert status="warning" variant="subtle" borderRadius="lg" bg="orange.900" color="orange.200">
            <AlertIcon /> Data may be stale: {error}
          </Alert>
        )}

        <NetworkHealth bufferRef={buffer} bufferVersion={bufferVersion} />

        <LifespanChart daily={graph.computeMetrics?.daily} totals={graph.computeMetrics?.totals} />

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
