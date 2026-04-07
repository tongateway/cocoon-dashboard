import { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, VStack, HStack, Heading, Text, Card, CardBody, CardHeader,
  Badge, Spinner, Center, Button, SimpleGrid, Table, Thead, Tbody,
  Tr, Th, Td, Divider, useClipboard, Tooltip, IconButton, Link,
} from '@chakra-ui/react';
import { getAddressInfo, getTransactions } from '../api/toncenter';
import { getAccountInfo, classifyCocoonContract } from '../api/tonapi';
import { ROOT_CONTRACT } from '../constants';
import { nanoToTon, timeAgo, classifyTransaction, truncateAddress } from '../lib/formatters';
import { parseTxOpcode, computeWalletSpend } from '../lib/opcodes';
import AddressCell from '../components/AddressCell';

const TYPE_COLORS = {
  payment: 'teal',
  'top-up': 'green',
  withdrawal: 'orange',
  deployment: 'purple',
  bounce: 'red',
  other: 'gray',
};

export default function AddressDetail({ networkData }) {
  const { address } = useParams();
  const [info, setInfo] = useState(null);
  const [contractType, setContractType] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const { hasCopied, onCopy } = useClipboard(address || '');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [addrInfo, addrTxs] = await Promise.all([
        getAddressInfo(address),
        getTransactions(address, 30),
      ]);
      setInfo(addrInfo);
      setTxs(addrTxs);

      // Get contract type from tonapi.io
      try {
        const tonapiInfo = await getAccountInfo(address);
        setContractType(classifyCocoonContract(tonapiInfo));
        setInterfaces(tonapiInfo.interfaces || []);
      } catch {
        setContractType(null);
        setInterfaces([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function loadMore() {
    if (txs.length === 0) return;
    setLoadingMore(true);
    try {
      const lastTx = txs[txs.length - 1];
      const moreTxs = await getTransactions(address, 30);
      // Use lt cursor for pagination
      const filtered = moreTxs.filter(tx =>
        parseInt(tx.transaction_id.lt) < parseInt(lastTx.transaction_id.lt)
      );
      if (filtered.length > 0) {
        setTxs(prev => [...prev, ...filtered]);
      }
    } catch (err) {
      console.warn('Failed to load more:', err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // Determine role — prefer tonapi contract type, fallback to network data
  const networkRole = getNetworkRole(address, networkData, contractType);

  if (loading) {
    return (
      <Box minH="80vh">
        <Center h="60vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.400" thickness="3px" />
            <Text color="gray.400">Loading address data...</Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="80vh" px={{ base: 4, lg: 8 }} py={6} maxW="1400px" mx="auto">
        <Button as={RouterLink} to="/" variant="ghost" color="brand.300" mb={4} size="sm">
          <BackIcon /> <Text ml={2}>Back to Dashboard</Text>
        </Button>
        <Card>
          <CardBody>
            <VStack spacing={3}>
              <Text color="red.400" fontSize="lg">Failed to load address</Text>
              <Text color="gray.500" fontSize="sm">{error}</Text>
              <Button colorScheme="teal" size="sm" onClick={fetchData}>Retry</Button>
            </VStack>
          </CardBody>
        </Card>
      </Box>
    );
  }

  const balance = nanoToTon(info?.balance || '0');
  const lastActivity = txs[0]?.utime || 0;
  const isCocoonWallet = contractType === 'cocoon_wallet' || contractType === 'proxy' || contractType === 'client' || contractType === 'worker';
  const spendStats = isCocoonWallet && txs.length > 0 ? computeWalletSpend(txs) : null;

  return (
    <Box px={{ base: 4, lg: 8 }} py={6} maxW="1400px" mx="auto">
      <Button as={RouterLink} to="/" variant="ghost" color="brand.300" mb={4} size="sm">
        <BackIcon /> <Text ml={2}>Back to Dashboard</Text>
      </Button>

      <VStack spacing={6} align="stretch">
        {/* Address Info Card */}
        <Card>
          <CardBody>
            <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={4}>
              <VStack align="start" spacing={2}>
                <HStack>
                  <Heading size="md" color="white">Address Details</Heading>
                  {networkRole.role !== 'unknown' && (
                    <Badge colorScheme={networkRole.color} fontSize="sm" px={2} py={0.5}>
                      {networkRole.role}
                    </Badge>
                  )}
                  {interfaces.length > 0 && interfaces.map(iface => (
                    <Badge key={iface} colorScheme="gray" variant="outline" fontSize="xs">
                      {iface}
                    </Badge>
                  ))}
                  <Badge
                    colorScheme={info?.state === 'active' ? 'green' : info?.state === 'frozen' ? 'blue' : 'gray'}
                    variant="subtle"
                  >
                    {info?.state || 'unknown'}
                  </Badge>
                </HStack>
                <HStack spacing={2} flexWrap="wrap">
                  <Text fontFamily="mono" fontSize="sm" color="brand.300" wordBreak="break-all">
                    {address}
                  </Text>
                  <Tooltip label={hasCopied ? 'Copied!' : 'Copy'} hasArrow>
                    <IconButton
                      icon={<CopyIcon />}
                      size="xs"
                      variant="ghost"
                      color="gray.500"
                      onClick={onCopy}
                      aria-label="Copy address"
                    />
                  </Tooltip>
                  <Link
                    href={`https://tonviewer.com/${address}`}
                    isExternal
                    fontSize="xs"
                    color="gray.500"
                    _hover={{ color: 'brand.300' }}
                  >
                    View on Tonviewer ↗
                  </Link>
                </HStack>
              </VStack>
            </HStack>
          </CardBody>
        </Card>

        {/* Balance + Info */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          <Card>
            <CardBody>
              <Text color="gray.400" fontSize="sm">Balance</Text>
              <Text color="white" fontSize="2xl" fontWeight="bold">{balance.toFixed(4)} TON</Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Text color="gray.400" fontSize="sm">Last Activity</Text>
              <Text color="white" fontSize="2xl" fontWeight="bold">
                {lastActivity ? timeAgo(lastActivity) : 'Never'}
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Text color="gray.400" fontSize="sm">Total Transactions</Text>
              <Text color="white" fontSize="2xl" fontWeight="bold">{txs.length}+</Text>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Compute Spend Stats (cocoon contracts only) */}
        {spendStats && (
          <Card>
            <CardHeader pb={2}>
              <Heading size="sm" color="white">Compute Spend</Heading>
            </CardHeader>
            <CardBody>
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
                <Box>
                  <Text color="gray.400" fontSize="xs">Total Received</Text>
                  <Text color="green.300" fontSize="lg" fontWeight="bold">{spendStats.totalReceived.toFixed(4)} TON</Text>
                </Box>
                <Box>
                  <Text color="gray.400" fontSize="xs">Total Sent (Compute)</Text>
                  <Text color="orange.300" fontSize="lg" fontWeight="bold">{spendStats.computeSpend.toFixed(4)} TON</Text>
                </Box>
                <Box>
                  <Text color="gray.400" fontSize="xs">Network Fees</Text>
                  <Text color="red.300" fontSize="lg" fontWeight="bold">{spendStats.totalFees.toFixed(4)} TON</Text>
                </Box>
                <Box>
                  <Text color="gray.400" fontSize="xs">Current Balance</Text>
                  <Text color="white" fontSize="lg" fontWeight="bold">{balance.toFixed(4)} TON</Text>
                </Box>
              </SimpleGrid>
              {Object.keys(spendStats.opCounts).length > 0 && (
                <Box>
                  <Text color="gray.400" fontSize="xs" mb={2}>Operations Breakdown</Text>
                  <HStack spacing={3} flexWrap="wrap">
                    {Object.entries(spendStats.opCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                      <Badge key={name} colorScheme="teal" variant="outline" px={2} py={1}>
                        {name}: {count}x
                      </Badge>
                    ))}
                  </HStack>
                </Box>
              )}
            </CardBody>
          </Card>
        )}

        {/* Network Relationships */}
        {networkRole.role !== 'unknown' && (
          <Card>
            <CardHeader pb={2}>
              <Heading size="sm" color="white">Network Relationships</Heading>
            </CardHeader>
            <CardBody>
              <VStack align="stretch" spacing={3}>
                {address === ROOT_CONTRACT && (
                  <Text color="gray.300" fontSize="sm">
                    This is the Cocoon Network root contract. It manages all proxies, allowed images, model hashes, and network configuration.
                  </Text>
                )}

                {networkRole.proxyAddress && (
                  <HStack>
                    <Text color="gray.400" fontSize="sm" minW="120px">Connected Proxy:</Text>
                    <AddressCell address={networkRole.proxyAddress} />
                  </HStack>
                )}

                {networkRole.rootAddress && (
                  <HStack>
                    <Text color="gray.400" fontSize="sm" minW="120px">Root Contract:</Text>
                    <AddressCell address={networkRole.rootAddress} />
                  </HStack>
                )}

                {networkRole.clients && networkRole.clients.length > 0 && (
                  <Box>
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Clients ({networkRole.clients.length}):
                    </Text>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={2}>
                      {networkRole.clients.map(addr => (
                        <Box key={addr} p={2} borderRadius="md" bg="#0d1117" border="1px" borderColor="#30363d">
                          <AddressCell address={addr} />
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}

                {networkRole.workers && networkRole.workers.length > 0 && (
                  <Box>
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Workers ({networkRole.workers.length}):
                    </Text>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={2}>
                      {networkRole.workers.map(addr => (
                        <Box key={addr} p={2} borderRadius="md" bg="#0d1117" border="1px" borderColor="#30363d">
                          <AddressCell address={addr} />
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}

                {networkRole.siblings && networkRole.siblings.length > 0 && (
                  <Box>
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Sibling {networkRole.role === 'client' ? 'Clients' : 'Workers'} (same proxy): {networkRole.siblings.length}
                    </Text>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={2}>
                      {networkRole.siblings.slice(0, 12).map(addr => (
                        <Box key={addr} p={2} borderRadius="md" bg="#0d1117" border="1px" borderColor="#30363d">
                          <AddressCell address={addr} />
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader pb={0}>
            <Heading size="sm" color="white">Transaction History</Heading>
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
                {txs.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} textAlign="center" color="gray.500" py={8}>
                      No transactions found
                    </Td>
                  </Tr>
                ) : (
                  txs.map((tx, i) => {
                    const inValue = parseInt(tx.in_msg?.value || '0');
                    const fee = parseInt(tx.fee || '0');
                    const txType = classifyTransaction(tx);
                    const opcode = parseTxOpcode(tx);
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
                          {opcode ? (
                            <Tooltip label={`${opcode.desc} (${opcode.opcode})`} hasArrow>
                              <Badge colorScheme={opcode.color} variant="subtle" fontSize="xs" cursor="help">
                                {opcode.name}
                              </Badge>
                            </Tooltip>
                          ) : (
                            <Badge colorScheme={TYPE_COLORS[txType]} variant="subtle" fontSize="xs">
                              {txType}
                            </Badge>
                          )}
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
            {txs.length >= 10 && (
              <Center mt={4}>
                <Button
                  size="sm"
                  variant="outline"
                  colorScheme="teal"
                  onClick={loadMore}
                  isLoading={loadingMore}
                >
                  Load More
                </Button>
              </Center>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}

function getNetworkRole(address, networkData, contractType) {
  const base = { role: 'unknown', color: 'gray', rootAddress: ROOT_CONTRACT };

  // Use tonapi contract type as primary source
  if (contractType === 'root' || address === ROOT_CONTRACT) {
    return { ...base, role: 'root', color: 'yellow' };
  }
  if (contractType === 'cocoon_wallet') {
    return { ...base, role: 'cocoon_wallet', color: 'teal' };
  }
  if (contractType === 'wallet') {
    return { ...base, role: 'wallet', color: 'gray' };
  }

  if (!networkData) {
    if (contractType === 'proxy') return { ...base, role: 'proxy', color: 'purple' };
    if (contractType === 'client') return { ...base, role: 'client', color: 'cyan' };
    if (contractType === 'worker') return { ...base, role: 'worker', color: 'orange' };
    return base;
  }

  // Check if it's a proxy
  if (networkData.proxies?.has(address)) {
    const proxy = networkData.proxies.get(address);
    return {
      ...base,
      role: 'proxy',
      color: 'purple',
      clients: proxy.clients ? [...proxy.clients.keys()] : [],
      workers: proxy.workers ? [...proxy.workers.keys()] : [],
    };
  }

  // Check if it's a client
  if (networkData.clients?.has(address)) {
    const client = networkData.clients.get(address);
    const proxyAddr = client.proxyAddress;
    const proxy = networkData.proxies?.get(proxyAddr);
    const siblings = proxy?.clients ? [...proxy.clients.keys()].filter(a => a !== address) : [];
    return {
      ...base,
      role: 'client',
      color: 'cyan',
      proxyAddress: proxyAddr,
      siblings,
    };
  }

  // Check if it's a worker
  if (networkData.workers?.has(address)) {
    const worker = networkData.workers.get(address);
    const proxyAddr = worker.proxyAddress;
    const proxy = networkData.proxies?.get(proxyAddr);
    const siblings = proxy?.workers ? [...proxy.workers.keys()].filter(a => a !== address) : [];
    return {
      ...base,
      role: 'worker',
      color: 'orange',
      proxyAddress: proxyAddr,
      siblings,
    };
  }

  return base;
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
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
