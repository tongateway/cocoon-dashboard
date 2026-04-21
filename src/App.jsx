import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Box, VStack, Spinner, Center, Text, Alert, AlertIcon } from '@chakra-ui/react';
import { useNetworkData } from './hooks/useNetworkData';
import Rail from './components/Rail';
import TopBar from './components/TopBar';
import LiveHero from './components/LiveHero';
import TrendCharts from './components/TrendCharts';
import LifespanChart from './components/LifespanChart';
import AgentsTable from './components/AgentsTable';
import TransactionFeed from './components/TransactionFeed';
import AddressDetail from './pages/AddressDetail';

function Dashboard({ data }) {
  const [windowId, setWindowId] = useState('24h');
  if (!data.graph) return null;
  const { graph, buffer, bufferVersion, isAlive, lastTxUtime } = data;

  return (
    <Box sx={{ padding: '24px 28px 80px', maxWidth: '1440px', width: '100%' }}>
      <VStack spacing={0} align="stretch">
        {data.error && (
          <Alert status="warning" variant="subtle"
                 sx={{
                   background: 'var(--warn-wash)',
                   color: 'var(--warn)',
                   border: '1px solid var(--warn-edge)',
                   borderRadius: 'var(--radius)',
                   marginBottom: '16px',
                 }}>
            <AlertIcon color="var(--warn)" />
            <Text fontSize="12.5px">Stale data — {data.error}</Text>
          </Alert>
        )}

        <LiveHero
          isAlive={isAlive}
          lastTxUtime={lastTxUtime}
          bufferRef={buffer}
          bufferVersion={bufferVersion}
          pricePerToken={graph.pricePerToken}
          computeMetricsTotals={graph.computeMetrics?.totals}
          window={windowId}
          onWindowChange={setWindowId}
          graph={graph}
        />

        <Box mt="24px">
          <TrendCharts bufferRef={buffer} bufferVersion={bufferVersion}
                       window={windowId} computeMetrics={graph.computeMetrics} />
        </Box>

        <LifespanChart daily={graph.computeMetrics?.daily} totals={graph.computeMetrics?.totals} />

        <AgentsTable graph={graph} />

        <TransactionFeed transactions={buffer.items()} />
      </VStack>
    </Box>
  );
}

function AppContent() {
  const data = useNetworkData();

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '56px 1fr', minHeight: '100vh' }}>
      <Rail />

      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          connected={data.connected}
          lastRefresh={data.lastRefresh}
          fallbackPoll={data.fallbackPoll}
          graph={data.graph}
          onRefresh={data.refresh}
        />

        {data.loading && !data.graph ? (
          <Center minH="60vh">
            <VStack spacing={3}>
              <Spinner size="md" color="var(--accent)" thickness="2px" emptyColor="var(--line)" />
              <Text fontSize="13px" color="var(--fg-2)">Discovering network…</Text>
            </VStack>
          </Center>
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard data={data} />} />
            <Route path="/address/:address" element={<AddressDetail networkData={data.graph} />} />
          </Routes>
        )}
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
