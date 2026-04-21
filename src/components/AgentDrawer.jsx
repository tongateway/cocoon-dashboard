import { useEffect } from 'react';
import { Box, HStack, VStack, Text, Grid, Link as ChakraLink } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import Sparkline from './Sparkline';
import { truncateAddress, nanoToTon, timeAgo } from '../lib/formatters';
import { parseTxOpcode } from '../lib/opcodes';
import { classifyTx, TX_TYPE } from '../lib/txClassify';

export default function AgentDrawer({ agent, graph, onClose }) {
  const open = !!agent;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Scrim */}
      <Box
        sx={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .2s var(--ease)',
          zIndex: 40,
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <Box
        as="aside"
        sx={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: { base: '100%', md: '520px' },
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--line)',
          boxShadow: '0 24px 60px -8px rgba(0,0,0,0.6)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .28s var(--ease-drawer)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {open && agent && <DrawerContent agent={agent} graph={graph} onClose={onClose} />}
      </Box>
    </>
  );
}

function DrawerContent({ agent, graph, onClose }) {
  const pulseCss = PULSE_CSS[agent.status] || PULSE_CSS.idle;
  const recentEvents = useRecentEventsForAgent(graph, agent.address, 6);

  // Build a throughput mini-chart from this agent's recent txs (in-value per tx)
  const miniValues = recentEvents.length > 1
    ? recentEvents.slice().reverse().map(e => parseInt(e.in_msg?.value || '0', 10) / 1e9)
    : [];

  return (
    <>
      {/* Head */}
      <Box sx={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)' }}>
        <HStack spacing="10px" align="center">
          <Box as="button" onClick={onClose}
               sx={{
                 width: '26px', height: '26px', display: 'grid', placeItems: 'center',
                 borderRadius: '5px', color: 'var(--fg-2)', cursor: 'pointer',
                 _hover: { background: 'var(--bg-2)', color: 'var(--fg-0)' },
               }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </Box>
          <HStack spacing="10px">
            <Box sx={{ width: '10px', height: '10px', borderRadius: '50%', ...pulseCss }} />
            <Text fontSize="14px" fontWeight="600" color="var(--fg-0)">
              {truncateAddress(agent.address)}
            </Text>
            <Text className="mono" fontSize="12px" color="var(--fg-2)">
              {agent.kind}
            </Text>
          </HStack>
          <Box flex={1} />
          <ChakraLink as={RouterLink} to={`/address/${agent.address}`}
                      sx={{
                        height: '26px', padding: '0 10px',
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        borderRadius: '5px',
                        border: '1px solid var(--line)',
                        background: 'var(--bg-1)',
                        color: 'var(--fg-0)',
                        fontSize: '11.5px', fontWeight: 500,
                        _hover: { background: 'var(--bg-2)', textDecoration: 'none' },
                      }}>
            Open file →
          </ChakraLink>
        </HStack>
      </Box>

      {/* Body */}
      <Box sx={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {/* Vitals */}
        <Section title="Vitals">
          <StatGrid items={[
            { lbl: 'Balance',      val: `${nanoToTon(agent.balance || '0').toFixed(2)} TON`, tone: 'var(--ok)' },
            { lbl: 'State',        val: agent.state || '—',
              tone: agent.state === 'active' ? 'var(--ok)' : 'var(--err)' },
            { lbl: 'Last activity', val: agent.lastActivity ? timeAgo(agent.lastActivity) : '—' },
            { lbl: 'Kind',          val: agent.kind },
          ]} />
        </Section>

        {/* Mini chart */}
        {miniValues.length > 1 && (
          <Section title="Recent tx values · last events">
            <Box sx={{ height: '90px', padding: '4px 0' }}>
              <Sparkline values={miniValues} color="var(--accent)" height={90} width={480} />
            </Box>
          </Section>
        )}

        {/* Relationships */}
        <Section title="Relationships">
          <VStack align="stretch" spacing="6px" fontSize="12.5px">
            {agent.kind === 'proxy' ? (
              <>
                <Row lbl="Clients served" val={String(agent.extras?.clients ?? '—')} />
                <Row lbl="Workers served" val={String(agent.extras?.workers ?? '—')} />
              </>
            ) : (agent.kind === 'client' || agent.kind === 'worker') && agent.extras?.proxyAddress ? (
              <Row lbl="Proxy" val={truncateAddress(agent.extras.proxyAddress)} mono />
            ) : (
              <Text fontSize="12px" color="var(--fg-2)">Standalone — no proxy relationship.</Text>
            )}
          </VStack>
        </Section>

        {/* Metadata */}
        <Section title="Metadata">
          <MetaList items={[
            ['Address',   agent.address],
            ['Kind',      agent.kind],
            ['State',     agent.state || '—'],
            ['Code hash', agent.extras?.codeHash || '—'],
            ['Balance',   `${nanoToTon(agent.balance || '0').toFixed(4)} TON`],
            ['Last tx',   agent.lastActivity ? new Date(agent.lastActivity * 1000).toISOString() : '—'],
          ]} />
        </Section>

        {/* Events */}
        <Section title="Recent events">
          {recentEvents.length === 0 ? (
            <Text fontSize="12px" color="var(--fg-2)">No events in the live buffer for this agent.</Text>
          ) : (
            <VStack align="stretch" spacing={0}>
              {recentEvents.map((e, i) => {
                const kind = classifyTx(e);
                const tone = LEVEL_TONE[kind] || 'var(--fg-1)';
                const label = LEVEL_LABEL[kind] || 'OTHER';
                return (
                  <Box key={i}
                       sx={{
                         display: 'grid',
                         gridTemplateColumns: '70px 70px 1fr auto',
                         gap: '10px',
                         padding: '5px 0',
                         fontSize: '11.5px',
                         fontFamily: 'var(--ff-mono)',
                         borderBottom: '1px dashed var(--line-soft)',
                         _last: { borderBottom: 0 },
                       }}>
                    <Text color="var(--fg-3)">{timeAgo(e.utime)}</Text>
                    <Text color={tone} fontSize="10.5px">{label}</Text>
                    <Text color="var(--fg-1)" isTruncated>
                      {eventSummary(e, agent)}
                    </Text>
                    <Text color="var(--ok)" fontWeight="500">
                      {e.in_msg?.value ? `+${nanoToTon(e.in_msg.value).toFixed(3)}` : ''}
                    </Text>
                  </Box>
                );
              })}
            </VStack>
          )}
        </Section>
      </Box>
    </>
  );
}

const PULSE_CSS = {
  ok:   { background: 'var(--ok)',   boxShadow: '0 0 0 3px var(--ok-ring)' },
  warn: { background: 'var(--warn)', boxShadow: '0 0 0 3px var(--warn-ring)' },
  err:  { background: 'var(--err)',  boxShadow: '0 0 0 3px var(--err-ring)' },
  idle: { background: 'var(--fg-3)' },
};

const LEVEL_TONE = {
  [TX_TYPE.WORKER_PAYOUT]: 'var(--info)',
  [TX_TYPE.CLIENT_CHARGE]: 'var(--accent)',
  [TX_TYPE.TOP_UP]:        'var(--warn)',
  [TX_TYPE.PROXY_FEE]:     'var(--fg-2)',
  [TX_TYPE.OTHER]:         'var(--fg-2)',
};
const LEVEL_LABEL = {
  [TX_TYPE.WORKER_PAYOUT]: 'PAYOUT',
  [TX_TYPE.CLIENT_CHARGE]: 'CHARGE',
  [TX_TYPE.TOP_UP]:        'TOPUP',
  [TX_TYPE.PROXY_FEE]:     'FEE',
  [TX_TYPE.OTHER]:         'OTHER',
};

function eventSummary(tx, agent) {
  const op = parseTxOpcode(tx);
  if (op) return op.name;
  const src = tx.in_msg?.source;
  if (src && src !== agent.address) return `from ${truncateAddress(src)}`;
  return 'on-chain event';
}

function useRecentEventsForAgent(graph, address, limit) {
  // Look at the most recent seeded txs where address matches — seeded txs are newest-first
  // Graph holds seedTxs; we filter those. Not used for live — live streams in via the buffer
  // but the graph snapshot is enough for drawer detail.
  const src = graph?.seedTxs || [];
  const out = [];
  for (const t of src) {
    if (t.address?.account_address === address || t.in_msg?.source === address) {
      out.push(t);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function Section({ title, children }) {
  return (
    <Box sx={{ '& + &': { marginTop: '24px' } }} mb="24px">
      <Text
        sx={{
          margin: '0 0 10px',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--fg-2)',
          fontWeight: 600,
        }}
      >
        {title}
      </Text>
      {children}
    </Box>
  );
}

function StatGrid({ items }) {
  return (
    <Grid
      templateColumns="1fr 1fr"
      gap="1px"
      sx={{
        background: 'var(--line-soft)',
        border: '1px solid var(--line-soft)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {items.map((it, i) => (
        <Box key={i} sx={{ background: 'var(--bg-1)', padding: '12px 14px' }}>
          <Text fontSize="11px" color="var(--fg-2)" mb="4px">{it.lbl}</Text>
          <Text className="mono" fontSize="15px" fontWeight="500" color={it.tone || 'var(--fg-0)'}>
            {it.val}
          </Text>
        </Box>
      ))}
    </Grid>
  );
}

function MetaList({ items }) {
  return (
    <Box
      as="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        rowGap: '8px',
        fontSize: '12.5px',
        margin: 0,
      }}
    >
      {items.map(([k, v], i) => (
        <>
          <Box as="dt" key={`k-${i}`} sx={{ color: 'var(--fg-2)', fontSize: '12px' }}>{k}</Box>
          <Box as="dd" key={`v-${i}`}
               sx={{ margin: 0, fontFamily: 'var(--ff-mono)', fontSize: '12px', color: 'var(--fg-0)', wordBreak: 'break-all' }}>
            {v}
          </Box>
        </>
      ))}
    </Box>
  );
}

function Row({ lbl, val, mono }) {
  return (
    <HStack justify="space-between">
      <Text color="var(--fg-2)" fontSize="12px">{lbl}</Text>
      <Text className={mono ? 'mono' : ''} fontSize="12.5px" color="var(--fg-0)" fontWeight="500">{val}</Text>
    </HStack>
  );
}
