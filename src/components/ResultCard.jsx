import { Box, HStack, VStack, Text, Grid, Button, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

const ROLE_META = {
  root:           { label: 'Root',          color: 'var(--warn)'   },
  cocoon_proxy:   { label: 'Proxy',         color: 'var(--violet)' },
  cocoon_client:  { label: 'Client',        color: 'var(--info)'   },
  cocoon_worker:  { label: 'Worker',        color: 'var(--warn)'   },
  cocoon_wallet:  { label: 'Cocoon wallet', color: 'var(--ok)'     },
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

  let relationship = null;
  if (isCocoon && graph) {
    if (type === 'cocoon_proxy') {
      const proxy = graph.proxies.get(address);
      relationship = proxy
        ? `Registered by root · serves ${proxy.clients?.size || 0} clients and ${proxy.workers?.size || 0} workers`
        : 'Cocoon proxy contract';
    } else if (type === 'cocoon_client') {
      const client = graph.clients.get(address);
      relationship = client?.proxyAddress
        ? `Registered by proxy ${short(client.proxyAddress)}`
        : 'Cocoon client contract';
    } else if (type === 'cocoon_worker') {
      const worker = graph.workers.get(address);
      relationship = worker?.proxyAddress
        ? `Registered by proxy ${short(worker.proxyAddress)}`
        : 'Cocoon worker contract';
    } else if (type === 'cocoon_wallet') {
      relationship = 'Cocoon wallet contract — holds funds used for inference charges';
    } else if (type === 'root') {
      relationship = 'Root contract — stores network config, proxy registry, and allowed code hashes';
    }
  } else {
    relationship = 'No interaction with Cocoon contracts. External TON address.';
  }

  return (
    <Box
      bg="var(--bg-elev-1)"
      border="1px solid"
      borderColor={isCocoon ? 'var(--accent-line)' : 'var(--line-faint)'}
      borderRadius="var(--radius)"
      p={4}
      className="fade-in"
    >
      <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
        <Box flex={1} minW="240px">
          <HStack spacing={2} mb={2} align="center">
            <Tag color={isCocoon ? 'var(--accent)' : 'var(--fg-dim)'} variant={isCocoon ? 'solid' : 'outline'}>
              {isCocoon ? 'Cocoon' : 'External'}
            </Tag>
            {meta && <Tag color={meta.color}>{meta.label}</Tag>}
          </HStack>

          <Text fontFamily="var(--ff-mono)" fontSize="12.5px" color="var(--fg-mid)" wordBreak="break-all" mb={2}>
            {address}
          </Text>

          <Text fontSize="12.5px" color="var(--fg-dim)" mb={3}>
            {relationship}
          </Text>

          <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}
                pt={3} borderTop="1px solid var(--line-faint)">
            <Fact k="Balance" v={`${(parseInt(balance || '0', 10) / 1e9).toFixed(2)} TON`} />
            <Fact k="State" v={state || '—'} tone={state === 'active' ? 'var(--ok)' : 'var(--fg)'} />
            <Fact k="Last activity" v={ago(lastActivity)} />
            <Fact k="Code hash" v={codeHash ? `${codeHash.slice(0, 4)}…${codeHash.slice(-4)}` : '—'} mono />
          </Grid>
        </Box>

        <VStack spacing={2} align="stretch" minW="140px">
          {isCocoon && (
            <DevButton as={RouterLink} to={`/address/${address}`} primary>
              Open →
            </DevButton>
          )}
          <DevButton onClick={() => navigator.clipboard.writeText(address)}>
            Copy
          </DevButton>
          <Link href={`https://tonviewer.com/${address}`} isExternal _hover={{ textDecoration: 'none' }}>
            <DevButton as="div" w="full">Tonviewer ↗</DevButton>
          </Link>
          <Button size="xs" variant="ghost" color="var(--fg-faint)" fontSize="11px"
                  _hover={{ color: 'var(--err)', bg: 'transparent' }} onClick={onDismiss}>
            Dismiss
          </Button>
        </VStack>
      </HStack>
    </Box>
  );
}

function Tag({ children, color, variant = 'outline' }) {
  const isSolid = variant === 'solid';
  return (
    <Box
      as="span"
      px="7px"
      py="2px"
      borderRadius="3px"
      fontSize="10.5px"
      fontWeight="600"
      letterSpacing="0.02em"
      color={isSolid ? '#06170d' : color}
      bg={isSolid ? color : 'transparent'}
      border={isSolid ? 'none' : `1px solid ${color}`}
    >
      {children}
    </Box>
  );
}

function Fact({ k, v, tone = 'var(--fg)', mono = false }) {
  return (
    <Box>
      <Text fontSize="10.5px" color="var(--fg-faint)" mb={1}>
        {k}
      </Text>
      <Text fontSize="13px" color={tone} fontFamily={mono ? 'var(--ff-mono)' : 'var(--ff-sans)'} fontWeight="500">
        {v}
      </Text>
    </Box>
  );
}

function DevButton({ children, primary, ...rest }) {
  return (
    <Button
      size="sm"
      h="28px"
      fontSize="12px"
      fontWeight="500"
      borderRadius="var(--radius-sm)"
      border="1px solid"
      borderColor={primary ? 'var(--accent)' : 'var(--line)'}
      bg={primary ? 'var(--accent)' : 'transparent'}
      color={primary ? '#06170d' : 'var(--fg-mid)'}
      _hover={{
        bg: primary ? 'var(--accent-dim)' : 'var(--bg-hover)',
        borderColor: primary ? 'var(--accent-dim)' : 'var(--line-strong)',
        color: primary ? '#06170d' : 'var(--fg)',
      }}
      sx={{ transition: 'all 120ms var(--ease)' }}
      {...rest}
    >
      {children}
    </Button>
  );
}
