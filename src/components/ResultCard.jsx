import { Box, HStack, VStack, Text, Grid, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

const ROLE_META = {
  root:           { label: 'ROOT',          color: 'var(--warn)' },
  cocoon_proxy:   { label: 'PROXY',         color: 'var(--info)' },
  cocoon_client:  { label: 'CLIENT',        color: 'var(--info)' },
  cocoon_worker:  { label: 'WORKER',        color: 'var(--warn)' },
  cocoon_wallet:  { label: 'COCOON WALLET', color: 'var(--ok)' },
};

function short(addr) { return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''; }
function ago(utime) {
  if (!utime) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - utime));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function ResultCard({ address, classification, graph, onDismiss }) {
  // eslint-disable-next-line no-unused-vars
  const { type, balance, state, lastActivity, codeHash, interfaces = [] } = classification;
  const isCocoon = (type && type.startsWith('cocoon_')) || type === 'root';
  const meta = ROLE_META[type];

  let relationship;
  if (isCocoon && graph) {
    if (type === 'cocoon_proxy') {
      const p = graph.proxies.get(address);
      relationship = p
        ? `Registered by root · serves ${p.clients?.size || 0} clients and ${p.workers?.size || 0} workers`
        : 'Cocoon proxy contract';
    } else if (type === 'cocoon_client') {
      const c = graph.clients.get(address);
      relationship = c?.proxyAddress ? `Registered by proxy ${short(c.proxyAddress)}` : 'Cocoon client contract';
    } else if (type === 'cocoon_worker') {
      const w = graph.workers.get(address);
      relationship = w?.proxyAddress ? `Registered by proxy ${short(w.proxyAddress)}` : 'Cocoon worker contract';
    } else if (type === 'cocoon_wallet') {
      relationship = 'Cocoon wallet contract — holds funds used for inference charges';
    } else if (type === 'root') {
      relationship = 'Root contract — stores network config, proxy registry, and allowed code hashes';
    }
  } else {
    relationship = 'External TON address — no interaction with Cocoon contracts.';
  }

  return (
    <Box
      sx={{
        background: 'var(--bg-1)',
        border: '1px solid',
        borderColor: isCocoon ? 'var(--ok-edge)' : 'var(--line-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 18px',
        position: 'relative',
      }}
    >
      <HStack spacing="10px" align="center" mb={2}>
        <Badge tone={isCocoon ? 'ok' : 'idle'}>{isCocoon ? 'COCOON' : 'EXTERNAL'}</Badge>
        {meta && <Badge color={meta.color}>{meta.label}</Badge>}
        <Box flex={1} />
        <Box as="button" onClick={onDismiss}
             sx={{
               width: '22px', height: '22px', display: 'grid', placeItems: 'center',
               color: 'var(--fg-2)', cursor: 'pointer', borderRadius: '4px',
               _hover: { background: 'var(--bg-2)', color: 'var(--fg-0)' },
             }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </Box>
      </HStack>

      <Text className="mono" fontSize="12px" color="var(--fg-1)" wordBreak="break-all" mb={2}>
        {address}
      </Text>
      <Text fontSize="12.5px" color="var(--fg-2)" mb={3}>
        {relationship}
      </Text>

      <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr) auto' }} gap={4}
            pt={3} borderTop="1px solid var(--line-soft)" alignItems="baseline">
        <Fact k="Balance" v={`${(parseInt(balance || '0', 10) / 1e9).toFixed(2)} TON`} mono />
        <Fact k="State" v={state || '—'} tone={state === 'active' ? 'var(--ok)' : 'var(--fg-0)'} />
        <Fact k="Last activity" v={ago(lastActivity)} mono />
        <Fact k="Code hash" v={codeHash ? `${codeHash.slice(0, 6)}…${codeHash.slice(-4)}` : '—'} mono />
        <HStack spacing="6px" justifySelf={{ base: 'start', md: 'end' }}>
          {isCocoon && (
            <InkButton as={RouterLink} to={`/address/${address}`} primary>Open →</InkButton>
          )}
          <InkButton onClick={() => navigator.clipboard.writeText(address)}>Copy</InkButton>
          <Link href={`https://tonviewer.com/${address}`} isExternal _hover={{ textDecoration: 'none' }}>
            <InkButton as="span">Tonviewer ↗</InkButton>
          </Link>
        </HStack>
      </Grid>
    </Box>
  );
}

function Badge({ children, tone, color }) {
  const presets = {
    ok:   { color: 'var(--ok)',   border: 'var(--ok-edge)',   bg: 'var(--ok-wash)' },
    warn: { color: 'var(--warn)', border: 'var(--warn-edge)', bg: 'var(--warn-wash)' },
    err:  { color: 'var(--err)',  border: 'var(--err-edge)',  bg: 'var(--err-wash)' },
    idle: { color: 'var(--fg-2)', border: 'var(--line)',      bg: 'var(--bg-2)' },
  };
  const s = tone ? presets[tone] : { color, border: 'var(--line)', bg: 'var(--bg-2)' };
  return (
    <Box as="span"
         sx={{
           display: 'inline-flex', alignItems: 'center', gap: '5px',
           height: '20px', padding: '0 7px',
           borderRadius: '4px',
           border: `1px solid ${s.border}`,
           background: s.bg,
           color: s.color,
           fontSize: '10.5px',
           fontWeight: 500,
           textTransform: 'uppercase',
           letterSpacing: '0.04em',
         }}>
      {children}
    </Box>
  );
}

function Fact({ k, v, tone = 'var(--fg-0)', mono }) {
  return (
    <Box>
      <Text fontSize="11px" color="var(--fg-2)" mb={1}>{k}</Text>
      <Text fontSize="13px" color={tone} className={mono ? 'mono' : ''} fontWeight="500">{v}</Text>
    </Box>
  );
}

function InkButton({ children, primary, ...rest }) {
  return (
    <Box
      as="button"
      sx={{
        height: '26px',
        padding: '0 10px',
        borderRadius: '5px',
        border: '1px solid',
        borderColor: primary ? 'transparent' : 'var(--line)',
        background: primary ? 'var(--fg-0)' : 'var(--bg-1)',
        color: primary ? 'var(--bg-0)' : 'var(--fg-0)',
        fontSize: '11.5px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        _hover: {
          background: primary ? 'oklch(88% 0.005 260)' : 'var(--bg-2)',
        },
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}
