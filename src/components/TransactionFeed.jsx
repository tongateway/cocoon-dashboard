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
  worker_payout: { label: 'payout', color: 'var(--info)'   },
  client_charge: { label: 'charge', color: 'var(--accent)' },
  top_up:        { label: 'top-up', color: 'var(--warn)'   },
  proxy_fee:     { label: 'fee',    color: 'var(--fg-dim)' },
  other:         { label: '—',      color: 'var(--fg-faint)' },
};

export default function TransactionFeed({ transactions }) {
  const displayTxs = useMemo(() => (transactions || []).slice(0, 80), [transactions]);

  return (
    <Box bg="var(--bg-elev-1)" border="1px solid var(--line-faint)" borderRadius="var(--radius)" className="fade-in">
      <HStack justify="space-between" align="center" px={4} py={3} borderBottom="1px solid var(--line-faint)">
        <HStack spacing={2}>
          <Text fontSize="13px" fontWeight="600" color="var(--fg)">Transactions</Text>
          <Text fontSize="11px" color="var(--fg-dim)" fontFamily="var(--ff-mono)">
            {displayTxs.length}
          </Text>
        </HStack>
        <HStack spacing={1.5}>
          <Box w="6px" h="6px" borderRadius="50%" bg="var(--accent)"
               sx={{ animation: 'pulse-dot 2s infinite' }} />
          <Text fontSize="10px" color="var(--fg-dim)" fontFamily="var(--ff-mono)">live</Text>
        </HStack>
      </HStack>

      <Box overflowX="auto">
        <Table size="sm" variant="unstyled" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <Thead>
            <Tr>
              <HeaderCell>Time</HeaderCell>
              <HeaderCell>Type</HeaderCell>
              <HeaderCell>From</HeaderCell>
              <HeaderCell>To</HeaderCell>
              <HeaderCell right>Value</HeaderCell>
              <HeaderCell right>Fee</HeaderCell>
            </Tr>
          </Thead>
          <Tbody>
            {displayTxs.length === 0 ? (
              <Tr>
                <Td colSpan={6} textAlign="center" py={6}>
                  <Text fontSize="12px" color="var(--fg-dim)">awaiting transactions…</Text>
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
                    _hover={{ bg: 'var(--bg-hover)' }}
                    sx={{ transition: 'background 100ms var(--ease)' }}
                  >
                    <BodyCell>
                      <Text fontFamily="var(--ff-mono)" fontSize="11.5px" color="var(--fg-dim)" whiteSpace="nowrap">
                        {timeAgo(tx.utime)}
                      </Text>
                    </BodyCell>
                    <BodyCell>
                      <Tooltip
                        label={opcode ? `${opcode.desc} (${opcode.opcode})` : tone.label}
                        hasArrow placement="top"
                        bg="var(--bg-elev-2)" color="var(--fg)"
                        borderColor="var(--line)" borderWidth="1px" fontSize="11px"
                      >
                        <Text
                          fontSize="10.5px"
                          fontFamily="var(--ff-mono)"
                          color={tone.color}
                          fontWeight="500"
                          cursor="help"
                          letterSpacing="0.02em"
                        >
                          {tone.label}
                        </Text>
                      </Tooltip>
                    </BodyCell>
                    <BodyCell><AddressCell address={tx.in_msg?.source} /></BodyCell>
                    <BodyCell><AddressCell address={tx.in_msg?.destination || tx.address?.account_address} /></BodyCell>
                    <BodyCell right>
                      <Text
                        fontFamily="var(--ff-mono)"
                        fontSize="12.5px"
                        color={inValue > 0 ? 'var(--accent)' : 'var(--fg-faint)'}
                        fontWeight="500"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {inValue > 0 ? `+${nanoToTon(inValue).toFixed(4)}` : '0'}
                      </Text>
                    </BodyCell>
                    <BodyCell right>
                      <Text fontFamily="var(--ff-mono)" fontSize="11px" color="var(--fg-faint)">
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
      py={2.5}
      px={4}
      borderBottom="1px solid var(--line-faint)"
      fontSize="10.5px"
      fontWeight="500"
      color="var(--fg-faint)"
      textAlign={right ? 'right' : 'left'}
      textTransform="none"
      letterSpacing="normal"
    >
      {children}
    </Th>
  );
}

function BodyCell({ children, right }) {
  return (
    <Td
      py={2.5}
      px={4}
      borderBottom="1px solid var(--line-faint)"
      textAlign={right ? 'right' : 'left'}
    >
      {children}
    </Td>
  );
}
