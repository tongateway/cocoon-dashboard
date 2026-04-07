import { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, VStack, HStack, Heading, Text, Card, CardBody, CardHeader,
  Badge, Spinner, Center, Button, SimpleGrid, Table, Thead, Tbody,
  Tr, Th, Td, useClipboard, Tooltip, IconButton, Link, Divider, Code,
} from '@chakra-ui/react';
import { fetchAnalysis, fetchTransactions } from '../api/backend';
import { nanoToTon, timeAgo, classifyTransaction } from '../lib/formatters';
import { parseTxOpcode } from '../lib/opcodes';
import AddressCell from '../components/AddressCell';

const TYPE_COLORS = { payment:'teal','top-up':'green',withdrawal:'orange',deployment:'purple',bounce:'red',other:'gray' };
const CONTRACT_COLORS = { cocoon_proxy:'purple', cocoon_client:'cyan', cocoon_worker:'orange', cocoon_wallet:'teal', cocoon_root:'yellow', wallet:'gray', unknown:'gray' };

export default function AddressDetail({ networkData }) {
  const { address } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { hasCopied, onCopy } = useClipboard(address || '');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [anal, txData] = await Promise.all([
        fetchAnalysis(address),
        fetchTransactions(address, 30),
      ]);
      setAnalysis(anal);
      setTxs(txData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <Box minH="80vh">
        <Center h="60vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.400" thickness="3px" />
            <Text color="gray.400">Analyzing address...</Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  if (error || !analysis) {
    return (
      <Box px={{ base: 4, lg: 8 }} py={6} maxW="1400px" mx="auto">
        <BackButton />
        <Card><CardBody><VStack spacing={3}>
          <Text color="red.400">Failed to load address</Text>
          <Text color="gray.500" fontSize="sm">{error}</Text>
          <Button colorScheme="teal" size="sm" onClick={fetchData}>Retry</Button>
        </VStack></CardBody></Card>
      </Box>
    );
  }

  const { type, balance, state, financials, tokenEstimates, operations, connections, activity } = analysis;
  const bal = nanoToTon(balance || '0');
  const isCocoon = type.startsWith('cocoon_');

  return (
    <Box px={{ base: 4, lg: 8 }} py={6} maxW="1400px" mx="auto">
      <BackButton />
      <VStack spacing={6} align="stretch">

        {/* Header Card */}
        <Card>
          <CardBody>
            <VStack align="start" spacing={2}>
              <HStack flexWrap="wrap" gap={2}>
                <Heading size="md" color="white">Address Details</Heading>
                {isCocoon && <Badge colorScheme={CONTRACT_COLORS[type]} fontSize="sm" px={2}>{type}</Badge>}
                <Badge colorScheme={state === 'active' ? 'green' : 'gray'} variant="subtle">{state}</Badge>
              </HStack>
              <HStack spacing={2} flexWrap="wrap">
                <Text fontFamily="mono" fontSize="sm" color="brand.300" wordBreak="break-all">{address}</Text>
                <Tooltip label={hasCopied ? 'Copied!' : 'Copy'} hasArrow>
                  <IconButton icon={<CopyIcon />} size="xs" variant="ghost" color="gray.500" onClick={onCopy} aria-label="Copy" />
                </Tooltip>
                <Link href={`https://tonviewer.com/${address}`} isExternal fontSize="xs" color="gray.500" _hover={{ color: 'brand.300' }}>
                  Tonviewer ↗
                </Link>
              </HStack>
              {activity.firstTx > 0 && (
                <Text fontSize="xs" color="gray.500">
                  Active: {new Date(activity.firstTx * 1000).toLocaleDateString()} — {new Date(activity.lastTx * 1000).toLocaleDateString()} ({activity.durationDays}d) | {analysis.totalTransactions} transactions
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Financial Summary */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <StatCard label="Balance" value={`${bal.toFixed(4)} TON`} color="white" />
          <StatCard label="Total Received" value={`${nanoToTon(financials.totalReceived).toFixed(4)} TON`} color="green.300" />
          <StatCard label="Compute Spend" value={`${nanoToTon(financials.computeSpend).toFixed(4)} TON`} color="orange.300" />
          <StatCard label="Network Fees" value={`${nanoToTon(financials.totalFees).toFixed(4)} TON`} color="red.300" />
        </SimpleGrid>

        {/* Token Usage Estimates */}
        {isCocoon && financials.computeSpend > 0 && (
          <Card>
            <CardHeader pb={2}><Heading size="sm" color="white">Token Usage Estimates</Heading></CardHeader>
            <CardBody>
              <Text fontSize="xs" color="gray.500" mb={3}>Based on root contract pricing (20 nanoTON/token base)</Text>
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Box>
                  <Text fontSize="xs" color="gray.400">Prompt tokens (1x)</Text>
                  <Text fontSize="lg" color="cyan.300" fontWeight="bold">{formatTokens(tokenEstimates.prompt.tokens)}</Text>
                  <Text fontSize="xs" color="gray.500">{tokenEstimates.prompt.priceNano} nanoTON/token</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.400">Completion tokens (8x)</Text>
                  <Text fontSize="lg" color="purple.300" fontWeight="bold">{formatTokens(tokenEstimates.completion.tokens)}</Text>
                  <Text fontSize="xs" color="gray.500">{tokenEstimates.completion.priceNano} nanoTON/token</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.400">Cached tokens (0.1x)</Text>
                  <Text fontSize="lg" color="green.300" fontWeight="bold">{formatTokens(tokenEstimates.cached.tokens)}</Text>
                  <Text fontSize="xs" color="gray.500">{tokenEstimates.cached.priceNano} nanoTON/token</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.400">Estimated mix (~3x)</Text>
                  <Text fontSize="lg" color="brand.300" fontWeight="bold">{formatTokens(tokenEstimates.estimatedMix)}</Text>
                  <Text fontSize="xs" color="gray.500">~60 nanoTON/token avg</Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        )}

        {/* Operations Breakdown */}
        {operations.length > 0 && (
          <Card>
            <CardHeader pb={2}><Heading size="sm" color="white">Operations</Heading></CardHeader>
            <CardBody>
              <HStack spacing={3} flexWrap="wrap">
                {operations.map(({ name, count }) => (
                  <Badge key={name} colorScheme="teal" variant="outline" px={3} py={1} fontSize="sm">
                    {name} <Text as="span" color="white" ml={1}>×{count}</Text>
                  </Badge>
                ))}
              </HStack>
            </CardBody>
          </Card>
        )}

        {/* Connected Contracts */}
        {connections.length > 0 && (
          <Card>
            <CardHeader pb={2}><Heading size="sm" color="white">Connected Contracts</Heading></CardHeader>
            <CardBody overflowX="auto">
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th>Address</Th>
                    <Th>Type</Th>
                    <Th isNumeric>TON Received</Th>
                    <Th isNumeric>TON Sent</Th>
                    <Th isNumeric>Balance</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {connections.map(conn => (
                    <Tr key={conn.address} _hover={{ bg: 'whiteAlpha.50' }}>
                      <Td><AddressCell address={conn.address} /></Td>
                      <Td>
                        <Badge colorScheme={CONTRACT_COLORS[conn.type] || 'gray'} variant="subtle" fontSize="xs">
                          {conn.type}
                        </Badge>
                      </Td>
                      <Td isNumeric>
                        <Text fontSize="sm" color={conn.tonReceived > 0 ? 'green.300' : 'gray.500'} fontFamily="mono">
                          {conn.tonReceived > 0 ? nanoToTon(conn.tonReceived).toFixed(4) : '—'}
                        </Text>
                      </Td>
                      <Td isNumeric>
                        <Text fontSize="sm" color={conn.tonSent > 0 ? 'orange.300' : 'gray.500'} fontFamily="mono">
                          {conn.tonSent > 0 ? nanoToTon(conn.tonSent).toFixed(4) : '—'}
                        </Text>
                      </Td>
                      <Td isNumeric>
                        <Text fontSize="sm" color="gray.300" fontFamily="mono">
                          {nanoToTon(conn.balance).toFixed(2)}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        )}

        {/* Transaction History */}
        <Card>
          <CardHeader pb={0}><Heading size="sm" color="white">Transaction History</Heading></CardHeader>
          <CardBody overflowX="auto">
            <Table size="sm" variant="simple">
              <Thead>
                <Tr><Th>Time</Th><Th>From</Th><Th>To</Th><Th isNumeric>Amount</Th><Th>Op</Th><Th isNumeric>Fee</Th></Tr>
              </Thead>
              <Tbody>
                {txs.length === 0 ? (
                  <Tr><Td colSpan={6} textAlign="center" color="gray.500" py={8}>No transactions</Td></Tr>
                ) : txs.map((tx, i) => {
                  const inValue = parseInt(tx.in_msg?.value || '0');
                  const fee = parseInt(tx.fee || '0');
                  const opcode = parseTxOpcode(tx);
                  const txType = classifyTransaction(tx);
                  return (
                    <Tr key={tx.transaction_id.lt + '-' + i} _hover={{ bg: 'whiteAlpha.50' }}>
                      <Td><Text fontSize="xs" color="gray.400" whiteSpace="nowrap">{timeAgo(tx.utime)}</Text></Td>
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
                            <Badge colorScheme={opcode.color} variant="subtle" fontSize="xs" cursor="help">{opcode.name}</Badge>
                          </Tooltip>
                        ) : (
                          <Badge colorScheme={TYPE_COLORS[txType]} variant="subtle" fontSize="xs">{txType}</Badge>
                        )}
                      </Td>
                      <Td isNumeric><Text fontSize="xs" color="gray.500" fontFamily="mono">{nanoToTon(fee).toFixed(4)}</Text></Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}

function StatCard({ label, value, color }) {
  return (
    <Card>
      <CardBody py={3}>
        <Text color="gray.400" fontSize="xs">{label}</Text>
        <Text color={color} fontSize="xl" fontWeight="bold">{value}</Text>
      </CardBody>
    </Card>
  );
}

function formatTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function BackButton() {
  return (
    <Button as={RouterLink} to="/" variant="ghost" color="brand.300" mb={4} size="sm">
      <BackIcon /> <Text ml={2}>Back to Dashboard</Text>
    </Button>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
