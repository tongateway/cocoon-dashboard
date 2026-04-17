import {
  Table, Thead, Tbody, Tr, Th, Td,
  Text, Box, HStack, Tooltip,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import AddressCell from './AddressCell';
import { timeAgo, nanoToTon } from '../lib/formatters';
import { classifyTx } from '../lib/txClassify';
import { parseTxOpcode } from '../lib/opcodes';

const TX_TONES = {
  worker_payout: { label: 'Payout',  color: 'var(--mint)'  },
  client_charge: { label: 'Charge',  color: 'var(--dusk)'  },
  top_up:        { label: 'Top-up',  color: 'var(--honey)' },
  proxy_fee:     { label: 'Fee',     color: 'var(--ink-mid)' },
  other:         { label: '—',       color: 'var(--ink-low)' },
};

export default function TransactionFeed({ transactions }) {
  const displayTxs = useMemo(() => (transactions || []).slice(0, 80), [transactions]);

  return (
    <Box className="fade-up">
      <HStack justify="space-between" align="baseline" mb={4} flexWrap="wrap" gap={3}>
        <HStack spacing={4} align="baseline">
          <Text fontSize="11px" fontFamily="var(--ff-mono)" letterSpacing="0.24em" textTransform="uppercase" color="var(--ink-low)">
            § VII · Ledger
          </Text>
          <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="16px" color="var(--ink-mid)"
                sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}>
            the most recent on-chain entries
          </Text>
        </HStack>
        <HStack spacing={2}>
          <Box w="6px" h="6px" borderRadius="50%" bg="var(--mint)"
               sx={{ animation: 'pulse-halo 2.4s infinite var(--ease-soft)' }} />
          <Text fontSize="10px" fontFamily="var(--ff-mono)" letterSpacing="0.18em" textTransform="uppercase"
                color="var(--ink-low)">
            {displayTxs.length} entries
          </Text>
        </HStack>
      </HStack>

      <Box
        borderTop="1px solid var(--line-faint)"
        borderBottom="1px solid var(--line-faint)"
        overflowX="auto"
      >
        <Table size="sm" variant="unstyled" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <Thead>
            <Tr>
              <HeaderCell>Time</HeaderCell>
              <HeaderCell>Type</HeaderCell>
              <HeaderCell>From</HeaderCell>
              <HeaderCell>To</HeaderCell>
              <HeaderCell right>Amount</HeaderCell>
              <HeaderCell right>Fee</HeaderCell>
            </Tr>
          </Thead>
          <Tbody>
            {displayTxs.length === 0 ? (
              <Tr>
                <Td colSpan={6} textAlign="center" py={8} border="none">
                  <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="14px" color="var(--ink-low)"
                        sx={{ fontVariationSettings: '"opsz" 16, "SOFT" 80' }}>
                    awaiting transactions…
                  </Text>
                </Td>
              </Tr>
            ) : (
              displayTxs.map((tx, i) => {
                const inValue = parseInt(tx.in_msg?.value || '0');
                const fee = parseInt(tx.fee || '0');
                const opcode = parseTxOpcode(tx);
                const t = classifyTx(tx);
                const tone = TX_TONES[t] || TX_TONES.other;

                return (
                  <Tr
                    key={tx.transaction_id.lt + '-' + i}
                    _hover={{ bg: 'rgba(255, 245, 228, 0.02)' }}
                    sx={{ transition: 'background 120ms var(--ease-soft)' }}
                  >
                    <BodyCell>
                      <Text fontFamily="var(--ff-mono)" fontSize="12px" color="var(--ink-low)" whiteSpace="nowrap">
                        {timeAgo(tx.utime)}
                      </Text>
                    </BodyCell>
                    <BodyCell>
                      <Tooltip
                        label={opcode ? `${opcode.desc} (${opcode.opcode})` : tone.label}
                        hasArrow
                        placement="top"
                        bg="var(--bg-void)"
                        color="var(--ink-high)"
                        borderColor="var(--line)"
                        borderWidth="1px"
                      >
                        <Box
                          as="span"
                          px={2}
                          py="2px"
                          fontSize="9.5px"
                          fontFamily="var(--ff-mono)"
                          fontWeight="500"
                          textTransform="uppercase"
                          letterSpacing="0.12em"
                          color={tone.color}
                          border={`1px solid ${tone.color}`}
                          borderRadius="1px"
                          cursor="help"
                        >
                          {tone.label}
                        </Box>
                      </Tooltip>
                    </BodyCell>
                    <BodyCell><AddressCell address={tx.in_msg?.source} /></BodyCell>
                    <BodyCell><AddressCell address={tx.in_msg?.destination || tx.address?.account_address} /></BodyCell>
                    <BodyCell right>
                      <Text
                        fontFamily="var(--ff-display)"
                        fontSize="16px"
                        color={inValue > 0 ? 'var(--mint)' : 'var(--ink-faint)'}
                        fontWeight="400"
                        sx={{ fontVariationSettings: '"opsz" 20, "SOFT" 30', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {inValue > 0 ? `+${nanoToTon(inValue).toFixed(4)}` : '0'}
                      </Text>
                    </BodyCell>
                    <BodyCell right>
                      <Text fontFamily="var(--ff-mono)" fontSize="11px" color="var(--ink-faint)">
                        {nanoToTon(fee).toFixed(4)}
                      </Text>
                    </BodyCell>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}

function HeaderCell({ children, right }) {
  return (
    <Th
      py={3}
      px={4}
      borderBottom="1px solid var(--line-faint)"
      fontSize="10px"
      fontFamily="var(--ff-body)"
      fontWeight="500"
      letterSpacing="0.22em"
      textTransform="uppercase"
      color="var(--ink-faint)"
      textAlign={right ? 'right' : 'left'}
    >
      {children}
    </Th>
  );
}

function BodyCell({ children, right }) {
  return (
    <Td
      py={3}
      px={4}
      borderBottom="1px solid var(--line-faint)"
      textAlign={right ? 'right' : 'left'}
    >
      {children}
    </Td>
  );
}
