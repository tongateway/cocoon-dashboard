import { Box, HStack, VStack, Text, Grid, Button, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

const ROLE_META = {
  root:           { label: 'Root',         color: '#f57520', bg: 'rgba(245,117,32,0.18)', border: 'rgba(245,117,32,0.35)' },
  cocoon_proxy:   { label: 'Proxy',        color: '#a371f7', bg: 'rgba(163,113,247,0.18)', border: 'rgba(163,113,247,0.35)' },
  cocoon_client:  { label: 'Client',       color: '#58a6ff', bg: 'rgba(88,166,255,0.18)', border: 'rgba(88,166,255,0.35)' },
  cocoon_worker:  { label: 'Worker',       color: '#d29922', bg: 'rgba(210,153,34,0.18)', border: 'rgba(210,153,34,0.35)' },
  cocoon_wallet:  { label: 'Cocoon wallet',color: '#3fb950', bg: 'rgba(63,185,80,0.18)', border: 'rgba(63,185,80,0.35)' },
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
    relationship = `This address has no interaction with Cocoon contracts.`;
  }

  return (
    <Box
      bg={isCocoon ? 'linear-gradient(180deg, rgba(63,185,80,0.05), #161b22 60%)' : '#161b22'}
      border="1px solid"
      borderColor={isCocoon ? 'rgba(63,185,80,0.4)' : '#30363d'}
      borderRadius="12px" p={4} mb={4}
    >
      <Grid templateColumns="auto 1fr auto" gap={4} alignItems="start">
        <Box w="56px" h="56px" borderRadius="12px" display="flex" alignItems="center" justifyContent="center"
             fontSize="24px" fontWeight="700"
             bg={isCocoon ? 'rgba(63,185,80,0.2)' : 'rgba(139,148,158,0.1)'}
             color={isCocoon ? '#3fb950' : '#8b949e'}>
          {isCocoon ? '✓' : '?'}
        </Box>
        <Box>
          <HStack>
            <Box as="span" px={2} py={0.5} borderRadius="999px" fontSize="10px" fontWeight="600"
                 textTransform="uppercase" letterSpacing="0.04em"
                 bg={isCocoon ? 'rgba(63,185,80,0.2)' : 'rgba(139,148,158,0.15)'}
                 color={isCocoon ? '#3fb950' : '#8b949e'}
                 border={`1px solid ${isCocoon ? 'rgba(63,185,80,0.45)' : 'rgba(139,148,158,0.35)'}`}>
              {isCocoon ? 'COCOON' : 'NOT COCOON'}
            </Box>
            {meta && (
              <Box as="span" px={2} py={0.5} borderRadius="999px" fontSize="10px" fontWeight="600"
                   textTransform="uppercase" letterSpacing="0.04em"
                   bg={meta.bg} color={meta.color} border={`1px solid ${meta.border}`}>
                {meta.label}
              </Box>
            )}
          </HStack>
          <Text fontFamily="mono" fontSize="12px" color="#58a6ff" mt={1} wordBreak="break-all">{address}</Text>
          <Text fontSize="12px" color="#8b949e" mt={3} p={2} bg="#0d1117" borderRadius="6px"
                border="1px dashed #30363d">
            {relationship}
          </Text>
          <Grid templateColumns="repeat(4, 1fr)" gap={3} mt={3} pt={3} borderTop="1px solid #30363d">
            <Fact k="Balance" v={`${(parseInt(balance || '0', 10) / 1e9).toFixed(2)} TON`} />
            <Fact k="State" v={state || '—'} color={state === 'active' ? '#3fb950' : '#e6edf3'} />
            <Fact k="Last activity" v={ago(lastActivity)} />
            <Fact k="Code hash" v={codeHash ? `${codeHash.slice(0, 4)}…${codeHash.slice(-4)}` : '—'}
                  fontFamily="mono" />
          </Grid>
        </Box>
        <VStack spacing={1} align="stretch">
          {isCocoon && (
            <Button as={RouterLink} to={`/address/${address}`} size="sm"
                    bg="#238636" color="white" _hover={{ bg: '#2ea043' }}>
              View details →
            </Button>
          )}
          <Button size="sm" variant="outline" borderColor="#30363d" color="#c9d1d9"
                  onClick={() => navigator.clipboard.writeText(address)}>
            Copy address
          </Button>
          <Link href={`https://tonviewer.com/${address}`} isExternal>
            <Button size="sm" variant="outline" borderColor="#30363d" color="#c9d1d9" w="full">
              Tonviewer ↗
            </Button>
          </Link>
          <Button size="xs" variant="ghost" color="#7d8590" onClick={onDismiss}>
            ✕ Dismiss
          </Button>
        </VStack>
      </Grid>
    </Box>
  );
}

function Fact({ k, v, color = '#e6edf3', fontFamily = 'inherit' }) {
  return (
    <Box>
      <Text fontSize="10px" textTransform="uppercase" color="#7d8590" letterSpacing="0.08em">{k}</Text>
      <Text fontSize="14px" color={color} mt={1} fontWeight="500" fontFamily={fontFamily}>{v}</Text>
    </Box>
  );
}
