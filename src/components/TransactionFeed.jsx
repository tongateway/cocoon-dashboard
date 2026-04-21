import { useMemo } from 'react';
import { Box, HStack, Text, Table, Thead, Tbody, Tr, Th, Td, Tooltip } from '@chakra-ui/react';
import AddressCell from './AddressCell';
import { timeAgo, nanoToTon } from '../lib/formatters';
import { classifyTx, TX_TYPE } from '../lib/txClassify';
import { parseTxOpcode } from '../lib/opcodes';

const TX_TONES = {
  [TX_TYPE.WORKER_PAYOUT]: { label: 'PAYOUT', color: 'var(--info)' },
  [TX_TYPE.CLIENT_CHARGE]: { label: 'CHARGE', color: 'var(--accent)' },
  [TX_TYPE.TOP_UP]:        { label: 'TOPUP',  color: 'var(--warn)' },
  [TX_TYPE.PROXY_FEE]:     { label: 'FEE',    color: 'var(--fg-2)' },
  [TX_TYPE.OTHER]:         { label: 'OTHER',  color: 'var(--fg-3)' },
};

export default function TransactionFeed({ transactions }) {
  const displayTxs = useMemo(() => (transactions || []).slice(0, 80), [transactions]);

  return (
    <Box
      id="events"
      sx={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '20px',
        overflow: 'hidden',
      }}
    >
      <Box sx={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <Box>
          <Text fontSize="13px" fontWeight="600" color="var(--fg-0)">Event stream</Text>
          <Text fontSize="12px" color="var(--fg-2)" mt="2px">
            <Text as="span" className="mono" color="var(--fg-0)">{displayTxs.length}</Text> most recent on-chain entries
          </Text>
        </Box>
        <Box flex={1} />
        <HStack spacing="6px">
          <Box w="6px" h="6px" borderRadius="50%" bg="var(--accent)"
               sx={{ boxShadow: '0 0 0 3px var(--ok-ring)', animation: 'pulse-dot 2.4s infinite' }} />
          <Text fontSize="10.5px" color="var(--fg-2)" className="mono" textTransform="uppercase" letterSpacing="0.06em">live</Text>
        </HStack>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="sm" variant="unstyled" sx={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '720px' }}>
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
                <Td colSpan={6} sx={{ textAlign: 'center', padding: '32px 0' }}>
                  <Text fontSize="12.5px" color="var(--fg-2)">awaiting transactions…</Text>
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
                  <Tr key={tx.transaction_id.lt + '-' + i}
                      sx={{
                        borderBottom: '1px solid var(--line-soft)',
                        _hover: { background: 'var(--bg-row-hover)' },
                        transition: 'background 80ms var(--ease)',
                        _last: { borderBottom: 0 },
                      }}>
                    <BodyCell>
                      <Text className="mono" fontSize="11.5px" color="var(--fg-2)" whiteSpace="nowrap">
                        {timeAgo(tx.utime)}
                      </Text>
                    </BodyCell>
                    <BodyCell>
                      <Tooltip label={opcode ? `${opcode.desc} (${opcode.opcode})` : tone.label}
                               hasArrow placement="top"
                               bg="var(--bg-2)" color="var(--fg-0)"
                               borderColor="var(--line)" borderWidth="1px" fontSize="11px">
                        <Text className="mono" fontSize="10.5px" fontWeight="500" color={tone.color}
                              cursor="help" letterSpacing="0.04em" textTransform="uppercase">
                          {tone.label}
                        </Text>
                      </Tooltip>
                    </BodyCell>
                    <BodyCell><AddressCell address={tx.in_msg?.source} /></BodyCell>
                    <BodyCell><AddressCell address={tx.in_msg?.destination || tx.address?.account_address} /></BodyCell>
                    <BodyCell right>
                      <Text className="mono" fontSize="12.5px" fontWeight="500"
                            color={inValue > 0 ? 'var(--ok)' : 'var(--fg-3)'}>
                        {inValue > 0 ? `+${nanoToTon(inValue).toFixed(4)}` : '0'}
                      </Text>
                    </BodyCell>
                    <BodyCell right>
                      <Text className="mono" fontSize="11px" color="var(--fg-3)">
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
      sx={{
        padding: '10px 14px',
        color: 'var(--fg-2)',
        fontWeight: 500,
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        borderBottom: '1px solid var(--line-soft)',
        background: 'var(--bg-1)',
        textAlign: right ? 'right' : 'left',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Th>
  );
}

function BodyCell({ children, right }) {
  return (
    <Td
      sx={{
        padding: '0 14px',
        height: 'var(--row-h)',
        verticalAlign: 'middle',
        textAlign: right ? 'right' : 'left',
      }}
    >
      {children}
    </Td>
  );
}
