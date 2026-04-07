import {
  Card, CardBody, CardHeader, Heading,
  SimpleGrid, Box, HStack, VStack, Text, Badge, Tabs, TabList, TabPanels, TabPanel, Tab,
} from '@chakra-ui/react';
import AddressCell from './AddressCell';
import { nanoToTon, timeAgo } from '../lib/formatters';

export default function ProxyCards({ proxies, clients, workers }) {
  const proxyList = proxies ? [...proxies.values()] : [];
  const clientList = clients ? [...clients.values()] : [];
  const workerList = workers ? [...workers.values()] : [];

  return (
    <Card>
      <CardHeader pb={0}>
        <Heading size="sm" color="white">Network Topology</Heading>
      </CardHeader>
      <CardBody>
        <Tabs variant="soft-rounded" colorScheme="teal" size="sm">
          <TabList mb={4} gap={2}>
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'brand.600' }}>
              Proxies ({proxyList.length})
            </Tab>
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'cyan.700' }}>
              Clients ({clientList.length})
            </Tab>
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'orange.700' }}>
              Workers ({workerList.length})
            </Tab>
          </TabList>

          <TabPanels>
            {/* Proxies Tab */}
            <TabPanel p={0}>
              {proxyList.length === 0 ? (
                <Box py={8} textAlign="center">
                  <Text color="gray.500">Discovering proxies...</Text>
                </Box>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                  {proxyList.map(proxy => (
                    <ContractCard
                      key={proxy.address}
                      address={proxy.address}
                      balance={proxy.balance}
                      state={proxy.state}
                      lastActivity={proxy.lastActivity}
                      badge="proxy"
                      badgeColor="purple"
                      extras={[
                        { label: 'Clients', value: proxy.clients?.size || 0, color: 'cyan.400' },
                        { label: 'Workers', value: proxy.workers?.size || 0, color: 'orange.400' },
                      ]}
                    />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>

            {/* Clients Tab */}
            <TabPanel p={0}>
              {clientList.length === 0 ? (
                <Box py={8} textAlign="center">
                  <Text color="gray.500">No clients discovered yet</Text>
                </Box>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                  {clientList.map(client => (
                    <ContractCard
                      key={client.address}
                      address={client.address}
                      balance={client.balance}
                      badge="client"
                      badgeColor="cyan"
                      extras={[
                        { label: 'Proxy', value: client.proxyAddress ? '1' : '0', color: 'purple.400' },
                      ]}
                      proxyAddress={client.proxyAddress}
                    />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>

            {/* Workers Tab */}
            <TabPanel p={0}>
              {workerList.length === 0 ? (
                <Box py={8} textAlign="center">
                  <Text color="gray.500">No workers discovered yet</Text>
                </Box>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                  {workerList.map(worker => (
                    <ContractCard
                      key={worker.address}
                      address={worker.address}
                      balance={worker.balance}
                      badge="worker"
                      badgeColor="orange"
                      extras={[
                        { label: 'Proxy', value: worker.proxyAddress ? '1' : '0', color: 'purple.400' },
                      ]}
                      proxyAddress={worker.proxyAddress}
                    />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </CardBody>
    </Card>
  );
}

function ContractCard({ address, balance, state, lastActivity, badge, badgeColor, extras, proxyAddress }) {
  return (
    <Box
      p={4}
      borderRadius="lg"
      border="1px"
      borderColor="#30363d"
      bg="#0d1117"
      _hover={{ borderColor: 'brand.600' }}
      transition="border-color 0.2s"
    >
      <HStack justify="space-between" mb={3}>
        <Badge colorScheme={badgeColor} variant="subtle" fontSize="xs">
          {badge}
        </Badge>
        {state && (
          <Badge colorScheme={state === 'active' ? 'green' : 'red'} variant="outline" fontSize="xs">
            {state}
          </Badge>
        )}
        {lastActivity ? (
          <Text fontSize="xs" color="gray.500">{timeAgo(lastActivity)}</Text>
        ) : null}
      </HStack>

      <AddressCell address={address} />

      {proxyAddress && (
        <HStack mt={2} spacing={1}>
          <Text fontSize="xs" color="gray.500">via</Text>
          <AddressCell address={proxyAddress} />
        </HStack>
      )}

      <HStack mt={3} spacing={4}>
        {balance && (
          <VStack spacing={0} align="start">
            <Text fontSize="xs" color="gray.500">Balance</Text>
            <Text fontSize="sm" color="white" fontWeight="bold">
              {nanoToTon(balance).toFixed(2)} TON
            </Text>
          </VStack>
        )}
        {extras?.map(ex => (
          <VStack key={ex.label} spacing={0} align="start">
            <Text fontSize="xs" color="gray.500">{ex.label}</Text>
            <Text fontSize="sm" color={ex.color} fontWeight="bold">{ex.value}</Text>
          </VStack>
        ))}
      </HStack>
    </Box>
  );
}
