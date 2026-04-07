import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Box, VStack, Grid, GridItem, Spinner, Center, Text, Alert, AlertIcon } from '@chakra-ui/react';
import { useNetworkData } from './hooks/useNetworkData';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import TransactionChart from './components/TransactionChart';
import SpendBreakdown from './components/SpendBreakdown';
import TransactionFeed from './components/TransactionFeed';
import TokenRevenueChart from './components/TokenRevenueChart';
import ProxyCards from './components/ProxyCards';
import AddressDetail from './pages/AddressDetail';

function Dashboard({ data, stats, error }) {
  return (
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

        <TokenRevenueChart volumeData={stats?.volumeData} />

        <ProxyCards rootConfig={data?.root?.config} proxies={data?.proxies} clients={data?.clients} workers={data?.workers} cocoonWallets={data?.cocoonWallets} />

        <TransactionFeed transactions={data?.allTransactions} />
      </VStack>
    </Box>
  );
}

function AppContent() {
  const { data, stats, loading, error, lastRefresh, isLive, refresh } = useNetworkData();

  return (
    <Box minH="100vh" bg="#0d1117">
      <Header isLive={isLive} lastRefresh={lastRefresh} onRefresh={refresh} loading={loading} />

      {loading && !data ? (
        <Center h="80vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.400" thickness="3px" />
            <Text color="gray.400">Discovering Cocoon Network contracts...</Text>
            <Text color="gray.600" fontSize="sm">This may take a few seconds</Text>
          </VStack>
        </Center>
      ) : (
        <Routes>
          <Route path="/" element={<Dashboard data={data} stats={stats} error={error} />} />
          <Route path="/address/:address" element={<AddressDetail networkData={data} />} />
        </Routes>
      )}
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
