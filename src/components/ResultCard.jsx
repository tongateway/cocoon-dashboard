import { Box, HStack, VStack, Text, Grid, Button, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

const ROLE_META = {
  root:           { label: 'Root',          color: 'var(--honey)' },
  cocoon_proxy:   { label: 'Proxy',         color: 'var(--plum)' },
  cocoon_client:  { label: 'Client',        color: 'var(--dusk)' },
  cocoon_worker:  { label: 'Worker',        color: 'var(--honey)' },
  cocoon_wallet:  { label: 'Cocoon wallet', color: 'var(--mint)' },
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
        : `Cocoon proxy contract`;
    } else if (type === 'cocoon_client') {
      const client = graph.clients.get(address);
      relationship = client?.proxyAddress
        ? `Registered by proxy ${short(client.proxyAddress)}`
        : `Cocoon client contract`;
    } else if (type === 'cocoon_worker') {
      const worker = graph.workers.get(address);
      relationship = worker?.proxyAddress
        ? `Registered by proxy ${short(worker.proxyAddress)}`
        : `Cocoon worker contract`;
    } else if (type === 'cocoon_wallet') {
      relationship = `Cocoon wallet contract — holds funds used for inference charges`;
    } else if (type === 'root') {
      relationship = `Root contract — stores network config, proxy registry, and allowed code hashes`;
    }
  } else {
    relationship = `No interaction with Cocoon contracts. This is an external address.`;
  }

  const verdict = isCocoon ? 'Cocoon' : 'External';
  const tint = isCocoon ? 'var(--honey)' : 'var(--ink-low)';

  return (
    <Box
      position="relative"
      borderTop="1px solid var(--line)"
      borderBottom="1px solid var(--line)"
      py={6}
      px={{ base: 4, md: 6 }}
      bg={isCocoon ? 'rgba(232, 198, 116, 0.03)' : 'rgba(0, 0, 0, 0.15)'}
      className="fade-up"
    >
      <Grid templateColumns={{ base: '1fr', md: '1fr auto' }} gap={6} alignItems="flex-start">
        <Box>
          {/* Verdict line — editorial */}
          <HStack spacing={3} align="baseline" flexWrap="wrap" mb={2}>
            <Text
              fontSize="10px"
              fontFamily="var(--ff-body)"
              letterSpacing="0.24em"
              textTransform="uppercase"
              color="var(--ink-low)"
              fontWeight="500"
            >
              Verdict
            </Text>
            <Box
              fontFamily="var(--ff-display)"
              fontSize={{ base: '28px', md: '34px' }}
              color={tint}
              fontWeight="300"
              sx={{
                fontVariationSettings: '"opsz" 72, "SOFT" 30',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {verdict}
            </Box>
            {meta && (
              <Text
                fontFamily="var(--ff-display)"
                fontStyle="italic"
                fontSize={{ base: '18px', md: '22px' }}
                color={meta.color}
                sx={{ fontVariationSettings: '"opsz" 48, "SOFT" 100' }}
              >
                — {meta.label}
              </Text>
            )}
          </HStack>

          {/* Address */}
          <Text
            fontFamily="var(--ff-mono)"
            fontSize="12px"
            color="var(--ink-mid)"
            wordBreak="break-all"
            mb={3}
          >
            {address}
          </Text>

          {/* Relationship blurb */}
          <Text
            fontFamily="var(--ff-display)"
            fontStyle="italic"
            fontSize="14px"
            color="var(--ink-mid)"
            sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}
            mb={4}
          >
            {relationship}
          </Text>

          {/* Facts */}
          <Grid
            templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
            gap={4}
            pt={3}
            borderTop="1px solid var(--line-faint)"
          >
            <Fact k="Balance" v={`${(parseInt(balance || '0', 10) / 1e9).toFixed(2)} TON`} />
            <Fact k="State" v={state || '—'} tone={state === 'active' ? 'var(--mint)' : 'var(--ink-high)'} />
            <Fact k="Last activity" v={ago(lastActivity)} />
            <Fact k="Code hash" v={codeHash ? `${codeHash.slice(0, 4)}…${codeHash.slice(-4)}` : '—'} mono />
          </Grid>
        </Box>

        {/* Action column */}
        <VStack spacing={2} align="stretch" minW={{ md: '180px' }}>
          {isCocoon && (
            <InkButton as={RouterLink} to={`/address/${address}`} primary>
              Open file →
            </InkButton>
          )}
          <InkButton onClick={() => navigator.clipboard.writeText(address)}>
            Copy address
          </InkButton>
          <Link href={`https://tonviewer.com/${address}`} isExternal _hover={{ textDecoration: 'none' }}>
            <InkButton w="full" as="div">Tonviewer ↗</InkButton>
          </Link>
          <Button size="xs" variant="ghost" color="var(--ink-faint)" fontFamily="var(--ff-mono)"
                  fontSize="10px" letterSpacing="0.18em" textTransform="uppercase"
                  _hover={{ color: 'var(--coral)', bg: 'transparent' }} onClick={onDismiss}>
            ✕ Dismiss
          </Button>
        </VStack>
      </Grid>
    </Box>
  );
}

function Fact({ k, v, tone = 'var(--ink-high)', mono = false }) {
  return (
    <Box>
      <Text
        fontSize="10px"
        textTransform="uppercase"
        color="var(--ink-faint)"
        letterSpacing="0.18em"
        fontFamily="var(--ff-body)"
        fontWeight="500"
        mb={1}
      >
        {k}
      </Text>
      <Text
        fontSize="15px"
        color={tone}
        fontFamily={mono ? 'var(--ff-mono)' : 'var(--ff-display)'}
        fontWeight="400"
        sx={{ fontVariationSettings: '"opsz" 24, "SOFT" 20' }}
      >
        {v}
      </Text>
    </Box>
  );
}

function InkButton({ children, primary, ...rest }) {
  return (
    <Button
      size="sm"
      height="36px"
      borderRadius="2px"
      border="1px solid"
      borderColor={primary ? 'var(--honey)' : 'var(--line)'}
      bg={primary ? 'var(--honey)' : 'transparent'}
      color={primary ? 'var(--bg-void)' : 'var(--ink-mid)'}
      fontFamily="var(--ff-mono)"
      fontSize="11px"
      fontWeight="500"
      letterSpacing="0.08em"
      _hover={{
        bg: primary ? 'var(--honey-lo)' : 'rgba(232, 198, 116, 0.08)',
        borderColor: primary ? 'var(--honey-lo)' : 'var(--honey)',
        color: primary ? 'var(--bg-void)' : 'var(--honey)',
      }}
      sx={{ transition: 'all 150ms var(--ease-soft)' }}
      {...rest}
    >
      {children}
    </Button>
  );
}
