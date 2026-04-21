import { useMemo, useState } from 'react';
import { Box, HStack, Text, Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/react';
import AgentDrawer from './AgentDrawer';
import { truncateAddress, nanoToTon, timeAgo } from '../lib/formatters';

const byBalanceDesc = (a, b) => parseInt(b?.balance || '0', 10) - parseInt(a?.balance || '0', 10);

// Unified agent = a row in the table representing any tracked Cocoon contract.
function buildAgents({ proxies, clients, workers, cocoonWallets, root }) {
  const now = Math.floor(Date.now() / 1000);
  const out = [];
  if (root) {
    out.push({
      kind: 'root', address: root.address, balance: root.balance,
      state: root.state, lastActivity: root.lastActivity,
      extras: { codeHash: root.codeHash },
    });
  }
  for (const p of proxies?.values() || []) {
    out.push({
      kind: 'proxy', address: p.address, balance: p.balance,
      state: p.state, lastActivity: p.lastActivity,
      extras: {
        clients: p.clients?.size || 0,
        workers: p.workers?.size || 0,
        codeHash: p.codeHash,
        proxyAddress: null,
      },
    });
  }
  for (const c of clients?.values() || []) {
    out.push({
      kind: 'client', address: c.address, balance: c.balance,
      state: c.state, lastActivity: c.lastActivity,
      extras: { proxyAddress: c.proxyAddress, codeHash: c.codeHash },
    });
  }
  for (const w of workers?.values() || []) {
    out.push({
      kind: 'worker', address: w.address, balance: w.balance,
      state: w.state, lastActivity: w.lastActivity,
      extras: { proxyAddress: w.proxyAddress, codeHash: w.codeHash },
    });
  }
  for (const cw of cocoonWallets?.values() || []) {
    out.push({
      kind: 'wallet', address: cw.address, balance: cw.balance,
      state: cw.state, lastActivity: cw.lastActivity,
      extras: { codeHash: cw.codeHash },
    });
  }
  // Derive status from state + lastActivity
  for (const a of out) {
    const silent = a.lastActivity ? (now - a.lastActivity) : null;
    if (a.state !== 'active') a.status = 'err';
    else if (!silent || silent > 7 * 86400) a.status = 'idle';
    else if (silent > 24 * 3600) a.status = 'warn';
    else a.status = 'ok';
  }
  return out.sort(byBalanceDesc);
}

const KIND_TABS = [
  { id: 'all',    label: 'All' },
  { id: 'proxy',  label: 'Proxies' },
  { id: 'worker', label: 'Workers' },
  { id: 'client', label: 'Clients' },
  { id: 'wallet', label: 'Cocoon wallets' },
];

const STATUS_TABS = [
  { id: 'all',  label: 'All' },
  { id: 'ok',   label: 'Healthy' },
  { id: 'warn', label: 'Degraded' },
  { id: 'err',  label: 'Error' },
  { id: 'idle', label: 'Idle' },
];

export default function AgentsTable({ graph }) {
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);

  const agents = useMemo(() => buildAgents({
    proxies: graph?.proxies,
    clients: graph?.clients,
    workers: graph?.workers,
    cocoonWallets: graph?.cocoonWallets,
    root: graph?.root,
  }), [graph]);

  const filtered = useMemo(() => {
    return agents.filter(a => (kind === 'all' || a.kind === kind) && (status === 'all' || a.status === status));
  }, [agents, kind, status]);

  return (
    <Box id="agents"
      sx={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '20px',
        overflow: 'hidden',
      }}
    >
      {/* Section head */}
      <Box sx={{ padding: '14px 18px', borderBottom: '1px solid var(--line-soft)' }}>
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <Box>
            <Text fontSize="13px" fontWeight="600" color="var(--fg-0)">Active agents</Text>
            <Text fontSize="12px" color="var(--fg-2)" mt="2px">
              <Text as="span" className="mono" color="var(--fg-0)">{filtered.length}</Text> of {agents.length} contracts · click a row for details
            </Text>
          </Box>
          <HStack spacing="8px" flexWrap="wrap">
            <Seg options={KIND_TABS} value={kind} onChange={setKind} />
            <Seg options={STATUS_TABS} value={status} onChange={setStatus} />
          </HStack>
        </HStack>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="sm" variant="unstyled" sx={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '800px' }}>
          <Thead>
            <Tr>
              <Th sx={headStyle}>Agent</Th>
              <Th sx={headStyle}>Kind</Th>
              <Th sx={headStyle}>Status</Th>
              <Th sx={{ ...headStyle, textAlign: 'right' }}>Balance</Th>
              <Th sx={{ ...headStyle, textAlign: 'right' }}>Relationships</Th>
              <Th sx={{ ...headStyle, textAlign: 'right' }}>Last seen</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr>
                <Td colSpan={6} sx={{ textAlign: 'center', padding: '32px 0' }}>
                  <Text fontSize="12.5px" color="var(--fg-2)">No agents match this filter.</Text>
                </Td>
              </Tr>
            ) : (
              filtered.map((a) => (
                <AgentRow
                  key={a.address}
                  agent={a}
                  selected={selected === a.address}
                  onClick={() => setSelected(a.address)}
                />
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      <AgentDrawer
        agent={filtered.find(x => x.address === selected) || agents.find(x => x.address === selected)}
        graph={graph}
        onClose={() => setSelected(null)}
      />
    </Box>
  );
}

const headStyle = {
  textAlign: 'left',
  padding: '10px 14px',
  color: 'var(--fg-2)',
  fontWeight: 500,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--line-soft)',
  background: 'var(--bg-1)',
  whiteSpace: 'nowrap',
};

function AgentRow({ agent, selected, onClick }) {
  const pulse = PULSE_CSS[agent.status] || PULSE_CSS.idle;
  return (
    <Tr
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        background: selected ? 'var(--bg-2)' : 'transparent',
        _hover: { background: selected ? 'var(--bg-2)' : 'var(--bg-row-hover)' },
        transition: 'background 80ms var(--ease)',
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <Td sx={rowStyle}>
        <HStack spacing="10px">
          <Box sx={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, ...pulse }} />
          <Text fontWeight="500" color="var(--fg-0)" fontSize="12.5px">
            {truncateAddress(agent.address)}
          </Text>
          <Text className="mono" color="var(--fg-2)" fontSize="11.5px">
            {agent.extras?.codeHash ? `· ${agent.extras.codeHash.slice(0, 8)}` : ''}
          </Text>
        </HStack>
      </Td>
      <Td sx={{ ...rowStyle, color: 'var(--fg-1)' }}>
        <Text className="mono" fontSize="11.5px" color="var(--fg-1)">{agent.kind}</Text>
      </Td>
      <Td sx={rowStyle}>
        <StatusBadge status={agent.status} />
      </Td>
      <Td sx={{ ...rowStyle, textAlign: 'right' }}>
        <Text className="mono" fontWeight="500" fontSize="12.5px">
          {nanoToTon(agent.balance || '0').toFixed(2)} <Text as="span" color="var(--fg-2)">TON</Text>
        </Text>
      </Td>
      <Td sx={{ ...rowStyle, textAlign: 'right', color: 'var(--fg-1)' }}>
        <Text className="mono" fontSize="11.5px">
          {relLabel(agent)}
        </Text>
      </Td>
      <Td sx={{ ...rowStyle, textAlign: 'right', color: 'var(--fg-1)' }}>
        <Text className="mono" fontSize="11.5px" color="var(--fg-2)">
          {agent.lastActivity ? `${timeAgo(agent.lastActivity)}` : '—'}
        </Text>
      </Td>
    </Tr>
  );
}

const rowStyle = {
  padding: '0 14px',
  height: 'var(--row-h)',
  color: 'var(--fg-0)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

const PULSE_CSS = {
  ok:   { background: 'var(--ok)',   boxShadow: '0 0 0 3px var(--ok-ring)' },
  warn: { background: 'var(--warn)', boxShadow: '0 0 0 3px var(--warn-ring)' },
  err:  { background: 'var(--err)',  boxShadow: '0 0 0 3px var(--err-ring)' },
  idle: { background: 'var(--fg-3)' },
};

function StatusBadge({ status }) {
  const map = {
    ok:   { tone: 'ok',   label: 'Healthy' },
    warn: { tone: 'warn', label: 'Degraded' },
    err:  { tone: 'err',  label: 'Error' },
    idle: { tone: 'idle', label: 'Idle' },
  };
  const { tone, label } = map[status] || map.idle;
  const presets = {
    ok:   { color: 'var(--ok)',   bg: 'var(--ok-wash)',   border: 'var(--ok-edge)' },
    warn: { color: 'var(--warn)', bg: 'var(--warn-wash)', border: 'var(--warn-edge)' },
    err:  { color: 'var(--err)',  bg: 'var(--err-wash)',  border: 'var(--err-edge)' },
    idle: { color: 'var(--fg-2)', bg: 'var(--bg-2)',      border: 'var(--line)' },
  };
  const s = presets[tone];
  return (
    <Box as="span" sx={{
      display: 'inline-flex', alignItems: 'center', height: '20px', padding: '0 7px',
      borderRadius: '4px', border: `1px solid ${s.border}`, background: s.bg, color: s.color,
      fontSize: '10.5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {label}
    </Box>
  );
}

function relLabel(a) {
  if (a.kind === 'proxy') return `${a.extras?.clients || 0}c / ${a.extras?.workers || 0}w`;
  if (a.kind === 'client' || a.kind === 'worker')
    return a.extras?.proxyAddress ? `via ${truncateAddress(a.extras.proxyAddress)}` : '—';
  return '—';
}

function Seg({ options, value, onChange }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        border: '1px solid var(--line)',
        borderRadius: '6px',
        padding: '2px',
        height: '28px',
        background: 'var(--bg-1)',
      }}
    >
      {options.map(o => {
        const active = value === o.id;
        return (
          <Box
            as="button"
            key={o.id}
            onClick={() => onChange(o.id)}
            sx={{
              background: active ? 'var(--bg-3)' : 'transparent',
              border: 0,
              color: active ? 'var(--fg-0)' : 'var(--fg-2)',
              fontSize: '11px',
              padding: '0 9px',
              height: '100%',
              borderRadius: '4px',
              cursor: 'pointer',
              _hover: { color: 'var(--fg-0)' },
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}
