import {
  Card, CardBody, CardHeader, Heading,
  SimpleGrid, Box, HStack, VStack, Text, Badge, Tabs, TabList, TabPanels, TabPanel, Tab,
  Divider, Code, Tooltip,
} from '@chakra-ui/react';
import AddressCell from './AddressCell';
import { nanoToTon, timeAgo } from '../lib/formatters';

export default function ProxyCards({ rootConfig, proxies, clients, workers, cocoonWallets }) {
  const proxyList = proxies ? [...proxies.values()] : [];
  const clientList = clients ? [...clients.values()] : [];
  const workerList = workers ? [...workers.values()] : [];
  const walletList = cocoonWallets ? [...cocoonWallets.values()] : [];

  return (
    <Card>
      <CardHeader pb={0}>
        <Heading size="sm" color="white">Network Topology</Heading>
      </CardHeader>
      <CardBody>
        <Tabs variant="soft-rounded" colorScheme="teal" size="sm">
          <TabList mb={4} gap={2} flexWrap="wrap">
            {rootConfig && (
              <Tab color="gray.400" _selected={{ color: 'white', bg: 'yellow.700' }}>
                Root Contract
              </Tab>
            )}
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'brand.600' }}>
              Proxies ({proxyList.length})
            </Tab>
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'cyan.700' }}>
              Clients ({clientList.length})
            </Tab>
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'orange.700' }}>
              Workers ({workerList.length})
            </Tab>
            {walletList.length > 0 && (
              <Tab color="gray.400" _selected={{ color: 'white', bg: 'teal.700' }}>
                Cocoon Wallets ({walletList.length})
              </Tab>
            )}
          </TabList>

          <TabPanels>
            {/* Root Contract Tab */}
            {rootConfig && (
              <TabPanel p={0}>
                <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                  {/* Pricing */}
                  <Box p={4} borderRadius="lg" border="1px" borderColor="#30363d" bg="#0d1117">
                    <Text color="yellow.400" fontWeight="bold" fontSize="sm" mb={3}>Pricing</Text>
                    <VStack spacing={2} align="stretch">
                      <ConfigRow label="Price per token" value={`${rootConfig.pricePerToken} nanoTON`} />
                      <ConfigRow label="Worker fee per token" value={`${rootConfig.workerFeePerToken} nanoTON`} />
                      <ConfigRow label="Proxy margin" value={`${rootConfig.pricePerToken - rootConfig.workerFeePerToken} nanoTON/token`} />
                      <Divider borderColor="#30363d" />
                      <ConfigRow label="Prompt multiplier" value={`${(rootConfig.promptMultiplier / 10000).toFixed(1)}x`} />
                      <ConfigRow label="Cached multiplier" value={`${(rootConfig.cachedMultiplier / 10000).toFixed(1)}x`} />
                      <ConfigRow label="Completion multiplier" value={`${(rootConfig.completionMultiplier / 10000).toFixed(1)}x`} />
                      <ConfigRow label="Reasoning multiplier" value={`${(rootConfig.reasoningMultiplier / 10000).toFixed(1)}x`} />
                    </VStack>
                  </Box>

                  {/* Network Config */}
                  <Box p={4} borderRadius="lg" border="1px" borderColor="#30363d" bg="#0d1117">
                    <Text color="yellow.400" fontWeight="bold" fontSize="sm" mb={3}>Network Config</Text>
                    <VStack spacing={2} align="stretch">
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.400">Owner</Text>
                        <AddressCell address={rootConfig.owner} />
                      </HStack>
                      <ConfigRow label="Struct version" value={rootConfig.structVersion} />
                      <ConfigRow label="Params version" value={rootConfig.paramsVersion} />
                      <ConfigRow label="Test mode" value={rootConfig.isTest ? 'Yes' : 'No'} />
                      <ConfigRow label="Last proxy seqno" value={rootConfig.lastProxySeqno} />
                      <Divider borderColor="#30363d" />
                      <ConfigRow label="Min proxy stake" value={`${(rootConfig.minProxyStake / 1e9).toFixed(0)} TON`} />
                      <ConfigRow label="Min client stake" value={`${(rootConfig.minClientStake / 1e9).toFixed(0)} TON`} />
                      <ConfigRow label="Proxy close delay" value={`${rootConfig.proxyDelayBeforeClose / 3600}h`} />
                      <ConfigRow label="Client close delay" value={`${rootConfig.clientDelayBeforeClose / 3600}h`} />
                    </VStack>
                  </Box>

                  {/* Proxy IPs */}
                  {rootConfig.proxyIPs?.length > 0 && (
                    <Box p={4} borderRadius="lg" border="1px" borderColor="#30363d" bg="#0d1117">
                      <Text color="yellow.400" fontWeight="bold" fontSize="sm" mb={3}>Registered Proxy Endpoints</Text>
                      <VStack spacing={2} align="stretch">
                        {rootConfig.proxyIPs.map((ip, i) => (
                          <HStack key={i} spacing={2}>
                            <Badge colorScheme="green" variant="subtle" fontSize="xs">
                              {ip.startsWith('!') ? 'workers' : 'clients'}
                            </Badge>
                            <Code fontSize="sm" bg="transparent" color="brand.300">
                              {ip.replace(/^!/, '')}
                            </Code>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  )}

                  {/* Token Economics */}
                  <Box p={4} borderRadius="lg" border="1px" borderColor="#30363d" bg="#0d1117">
                    <Text color="yellow.400" fontWeight="bold" fontSize="sm" mb={3}>Token Economics</Text>
                    <VStack spacing={2} align="stretch">
                      <Tooltip label="Cost for 1M prompt tokens" hasArrow>
                        <HStack justify="space-between" cursor="help">
                          <Text fontSize="xs" color="gray.400">1M prompt tokens</Text>
                          <Text fontSize="sm" color="white" fontWeight="bold">
                            {((rootConfig.pricePerToken * rootConfig.promptMultiplier / 10000) * 1e6 / 1e9).toFixed(4)} TON
                          </Text>
                        </HStack>
                      </Tooltip>
                      <Tooltip label="Cost for 1M completion tokens" hasArrow>
                        <HStack justify="space-between" cursor="help">
                          <Text fontSize="xs" color="gray.400">1M completion tokens</Text>
                          <Text fontSize="sm" color="white" fontWeight="bold">
                            {((rootConfig.pricePerToken * rootConfig.completionMultiplier / 10000) * 1e6 / 1e9).toFixed(4)} TON
                          </Text>
                        </HStack>
                      </Tooltip>
                      <Tooltip label="Cost for 1M reasoning tokens" hasArrow>
                        <HStack justify="space-between" cursor="help">
                          <Text fontSize="xs" color="gray.400">1M reasoning tokens</Text>
                          <Text fontSize="sm" color="white" fontWeight="bold">
                            {((rootConfig.pricePerToken * rootConfig.reasoningMultiplier / 10000) * 1e6 / 1e9).toFixed(4)} TON
                          </Text>
                        </HStack>
                      </Tooltip>
                      <Tooltip label="Cost for 1M cached tokens" hasArrow>
                        <HStack justify="space-between" cursor="help">
                          <Text fontSize="xs" color="gray.400">1M cached tokens</Text>
                          <Text fontSize="sm" color="white" fontWeight="bold">
                            {((rootConfig.pricePerToken * rootConfig.cachedMultiplier / 10000) * 1e6 / 1e9).toFixed(4)} TON
                          </Text>
                        </HStack>
                      </Tooltip>
                    </VStack>
                  </Box>
                </SimpleGrid>
              </TabPanel>
            )}

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
            {/* Cocoon Wallets Tab */}
            {walletList.length > 0 && (
              <TabPanel p={0}>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                  {walletList.map(cw => (
                    <ContractCard
                      key={cw.address}
                      address={cw.address}
                      balance={cw.balance}
                      state={cw.state}
                      badge="cocoon_wallet"
                      badgeColor="teal"
                    />
                  ))}
                </SimpleGrid>
              </TabPanel>
            )}
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

function ConfigRow({ label, value }) {
  return (
    <HStack justify="space-between">
      <Text fontSize="xs" color="gray.400">{label}</Text>
      <Text fontSize="sm" color="white" fontWeight="medium">{value}</Text>
    </HStack>
  );
}
