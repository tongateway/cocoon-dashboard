import {
  Card, CardBody, CardHeader, Heading,
  Table, Thead, Tbody, Tr, Th, Td,
  Text, Box, HStack, Tooltip,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import AddressCell from './AddressCell';
import { timeAgo, nanoToTon } from '../lib/formatters';
import { classifyTx, TX_TYPE_LABEL } from '../lib/txClassify';
import { parseTxOpcode } from '../lib/opcodes';


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
                      {(() => {
                        const t = classifyTx(tx);
                        const info = TX_TYPE_LABEL[t];
                        return (
                          <Tooltip label={opcode ? `${opcode.desc} (${opcode.opcode})` : info.label} hasArrow placement="top">
                            <Box as="span" px={2} py={0.5} fontSize="9px" fontWeight="600"
                                 textTransform="uppercase" letterSpacing="0.04em" borderRadius="3px"
                                 bg={info.bg} color={info.color} cursor="help">
                              {info.label}
                            </Box>
                          </Tooltip>
                        );
                      })()}
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
