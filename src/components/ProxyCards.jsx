import {
  SimpleGrid, Box, HStack, VStack, Text, Tabs, TabList, TabPanels, TabPanel, Tab,
  Divider, Code, Tooltip,
} from '@chakra-ui/react';
import AddressCell from './AddressCell';
import { nanoToTon, timeAgo } from '../lib/formatters';

const byBalanceDesc = (a, b) => parseInt(b?.balance || '0', 10) - parseInt(a?.balance || '0', 10);

const TONES = {
  proxy:  'var(--violet)',
  client: 'var(--info)',
  worker: 'var(--warn)',
  wallet: 'var(--ok)',
  root:   'var(--warn)',
};

export default function ProxyCards({ rootConfig, proxies, clients, workers, cocoonWallets }) {
  const proxyList  = proxies       ? [...proxies.values()].sort(byBalanceDesc)       : [];
  const clientList = clients       ? [...clients.values()].sort(byBalanceDesc)       : [];
  const workerList = workers       ? [...workers.values()].sort(byBalanceDesc)       : [];
  const walletList = cocoonWallets ? [...cocoonWallets.values()].sort(byBalanceDesc) : [];

  return (
    <Box bg="var(--bg-elev-1)" border="1px solid var(--line-faint)" borderRadius="var(--radius)" className="fade-in">
      <Box px={4} pt={4} pb={0}>
        <HStack justify="space-between" align="center" mb={3}>
          <Text fontSize="13px" fontWeight="600" color="var(--fg)">Network topology</Text>
          <Text fontSize="11px" color="var(--fg-dim)">sorted by balance</Text>
        </HStack>
      </Box>

      <Tabs variant="unstyled" size="sm">
        <TabList px={4} gap={0} borderBottom="1px solid var(--line-faint)">
          {rootConfig && <DevTab tone={TONES.root}>Root</DevTab>}
          <DevTab tone={TONES.proxy}>Proxies · {proxyList.length}</DevTab>
          <DevTab tone={TONES.client}>Clients · {clientList.length}</DevTab>
          <DevTab tone={TONES.worker}>Workers · {workerList.length}</DevTab>
          {walletList.length > 0 && <DevTab tone={TONES.wallet}>Cocoon wallets · {walletList.length}</DevTab>}
        </TabList>

        <TabPanels>
          {rootConfig && (
            <TabPanel p={4}>
              <RootConfigPanel rootConfig={rootConfig} />
            </TabPanel>
          )}

          <TabPanel p={0}>
            {proxyList.length === 0 ? <Empty text="Discovering proxies…" /> : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={0}>
                {proxyList.map(p => (
                  <ContractCard key={p.address} address={p.address} balance={p.balance} state={p.state}
                    lastActivity={p.lastActivity} kind="proxy" tone={TONES.proxy}
                    extras={[
                      { label: 'Clients', value: p.clients?.size || 0 },
                      { label: 'Workers', value: p.workers?.size || 0 },
                    ]} />
                ))}
              </SimpleGrid>
            )}
          </TabPanel>

          <TabPanel p={0}>
            {clientList.length === 0 ? <Empty text="No clients discovered yet" /> : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={0}>
                {clientList.map(c => (
                  <ContractCard key={c.address} address={c.address} balance={c.balance} kind="client" tone={TONES.client}
                    proxyAddress={c.proxyAddress} />
                ))}
              </SimpleGrid>
            )}
          </TabPanel>

          <TabPanel p={0}>
            {workerList.length === 0 ? <Empty text="No workers discovered yet" /> : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={0}>
                {workerList.map(w => (
                  <ContractCard key={w.address} address={w.address} balance={w.balance} kind="worker" tone={TONES.worker}
                    proxyAddress={w.proxyAddress} />
                ))}
              </SimpleGrid>
            )}
          </TabPanel>

          {walletList.length > 0 && (
            <TabPanel p={0}>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={0}>
                {walletList.map(cw => (
                  <ContractCard key={cw.address} address={cw.address} balance={cw.balance} state={cw.state}
                    kind="cocoon_wallet" tone={TONES.wallet} />
                ))}
              </SimpleGrid>
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
    </Box>
  );
}

function DevTab({ children, tone = 'var(--fg)' }) {
  return (
    <Tab
      px={3}
      py={2.5}
      color="var(--fg-dim)"
      fontSize="12px"
      fontWeight="500"
      borderBottom="2px solid transparent"
      mb="-1px"
      _selected={{
        color: tone,
        borderColor: tone,
      }}
      _hover={{ color: 'var(--fg)' }}
      sx={{ transition: 'color 150ms var(--ease), border-color 150ms var(--ease)' }}
    >
      {children}
    </Tab>
  );
}

function Empty({ text }) {
  return (
    <Box py={10} textAlign="center">
      <Text fontSize="12px" color="var(--fg-dim)">{text}</Text>
    </Box>
  );
}

function ContractCard({ address, balance, state, lastActivity, kind, tone, extras, proxyAddress }) {
  return (
    <Box
      p={4}
      borderRight={{ md: '1px solid var(--line-faint)' }}
      borderBottom="1px solid var(--line-faint)"
      _hover={{ bg: 'var(--bg-hover)' }}
      sx={{ transition: 'background 120ms var(--ease)' }}
    >
      <HStack justify="space-between" mb={3}>
        <Text fontSize="10px" fontFamily="var(--ff-mono)" color={tone}
              fontWeight="600" letterSpacing="0.04em" textTransform="uppercase">
          {kind}
        </Text>
        {state && (
          <HStack spacing={1}>
            <Box w="6px" h="6px" borderRadius="50%"
                 bg={state === 'active' ? 'var(--ok)' : 'var(--err)'} />
            <Text fontSize="10px" fontFamily="var(--ff-mono)" color="var(--fg-dim)">
              {state}
            </Text>
          </HStack>
        )}
      </HStack>

      <AddressCell address={address} />

      {proxyAddress && (
        <HStack mt={1.5} spacing={1.5}>
          <Text fontSize="10px" color="var(--fg-faint)" fontFamily="var(--ff-mono)">via</Text>
          <AddressCell address={proxyAddress} />
        </HStack>
      )}

      <HStack mt={3} spacing={5} align="baseline">
        {balance && (
          <VStack spacing={0} align="start">
            <Text fontSize="10px" color="var(--fg-faint)">Balance</Text>
            <Text fontSize="16px" color="var(--fg)" fontWeight="500"
                  sx={{ letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {nanoToTon(balance).toFixed(2)}
              <Text as="span" fontSize="10px" color="var(--fg-faint)" ml={1} fontFamily="var(--ff-mono)">TON</Text>
            </Text>
          </VStack>
        )}
        {extras?.map(ex => (
          <VStack key={ex.label} spacing={0} align="start">
            <Text fontSize="10px" color="var(--fg-faint)">{ex.label}</Text>
            <Text fontSize="16px" color="var(--fg-mid)" fontWeight="500">{ex.value}</Text>
          </VStack>
        ))}
        {lastActivity ? (
          <VStack spacing={0} align="start" ml="auto">
            <Text fontSize="10px" color="var(--fg-faint)">Last</Text>
            <Text fontSize="12px" color="var(--fg-dim)" fontFamily="var(--ff-mono)">
              {timeAgo(lastActivity)}
            </Text>
          </VStack>
        ) : null}
      </HStack>
    </Box>
  );
}

function RootConfigPanel({ rootConfig }) {
  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={3}>
      <Panel title="Pricing">
        <Row label="Price per token" value={`${rootConfig.pricePerToken} nanoTON`} />
        <Row label="Worker fee per token" value={`${rootConfig.workerFeePerToken} nanoTON`} />
        <Row label="Proxy margin" value={`${rootConfig.pricePerToken - rootConfig.workerFeePerToken} nanoTON/tok`} />
        <Divider borderColor="var(--line-faint)" my={1} />
        <Row label="Prompt ×" value={`${(rootConfig.promptMultiplier / 10000).toFixed(1)}x`} />
        <Row label="Cached ×" value={`${(rootConfig.cachedMultiplier / 10000).toFixed(1)}x`} />
        <Row label="Completion ×" value={`${(rootConfig.completionMultiplier / 10000).toFixed(1)}x`} />
        <Row label="Reasoning ×" value={`${(rootConfig.reasoningMultiplier / 10000).toFixed(1)}x`} />
      </Panel>

      <Panel title="Config">
        <HStack justify="space-between">
          <Text fontSize="11px" color="var(--fg-dim)">Owner</Text>
          <AddressCell address={rootConfig.owner} />
        </HStack>
        <Row label="Struct ver" value={rootConfig.structVersion} />
        <Row label="Params ver" value={rootConfig.paramsVersion} />
        <Row label="Test mode" value={rootConfig.isTest ? 'Yes' : 'No'} />
        <Row label="Last seqno" value={rootConfig.lastProxySeqno} />
        <Divider borderColor="var(--line-faint)" my={1} />
        <Row label="Min proxy stake" value={`${(rootConfig.minProxyStake / 1e9).toFixed(0)} TON`} />
        <Row label="Min client stake" value={`${(rootConfig.minClientStake / 1e9).toFixed(0)} TON`} />
        <Row label="Proxy close delay" value={`${rootConfig.proxyDelayBeforeClose / 3600}h`} />
        <Row label="Client close delay" value={`${rootConfig.clientDelayBeforeClose / 3600}h`} />
      </Panel>

      {rootConfig.proxyIPs?.length > 0 && (
        <Panel title="Proxy endpoints">
          <VStack spacing={1.5} align="stretch">
            {rootConfig.proxyIPs.map((ip, i) => (
              <HStack key={i} spacing={2}>
                <Text fontSize="9px" fontFamily="var(--ff-mono)" color={ip.startsWith('!') ? 'var(--warn)' : 'var(--info)'}
                      letterSpacing="0.04em" textTransform="uppercase" fontWeight="600">
                  {ip.startsWith('!') ? 'workers' : 'clients'}
                </Text>
                <Code fontSize="12px" bg="transparent" color="var(--fg-mid)" fontFamily="var(--ff-mono)" p={0}>
                  {ip.replace(/^!/, '')}
                </Code>
              </HStack>
            ))}
          </VStack>
        </Panel>
      )}

      <Panel title="Token economics">
        <TokenCost rootConfig={rootConfig} label="1M prompt" multKey="promptMultiplier" />
        <TokenCost rootConfig={rootConfig} label="1M completion" multKey="completionMultiplier" />
        <TokenCost rootConfig={rootConfig} label="1M reasoning" multKey="reasoningMultiplier" />
        <TokenCost rootConfig={rootConfig} label="1M cached" multKey="cachedMultiplier" />
      </Panel>
    </SimpleGrid>
  );
}

function TokenCost({ rootConfig, label, multKey }) {
  const cost = ((rootConfig.pricePerToken * rootConfig[multKey] / 10000) * 1e6 / 1e9).toFixed(4);
  return (
    <Tooltip label={`Cost for ${label.toLowerCase()} tokens`} hasArrow>
      <HStack justify="space-between" cursor="help">
        <Text fontSize="11px" color="var(--fg-dim)">{label}</Text>
        <Text fontSize="12px" color="var(--fg)" fontFamily="var(--ff-mono)" fontWeight="500">
          {cost} TON
        </Text>
      </HStack>
    </Tooltip>
  );
}

function Panel({ title, children }) {
  return (
    <Box bg="var(--bg-elev-2)" border="1px solid var(--line-faint)" borderRadius="var(--radius-sm)" p={3}>
      <Text fontSize="11px" color="var(--fg-dim)" fontWeight="600" mb={2}>
        {title}
      </Text>
      <VStack spacing={1.5} align="stretch">{children}</VStack>
    </Box>
  );
}

function Row({ label, value }) {
  return (
    <HStack justify="space-between" align="baseline">
      <Text fontSize="11px" color="var(--fg-dim)">{label}</Text>
      <Text fontSize="12px" color="var(--fg)" fontFamily="var(--ff-mono)" fontWeight="500">
        {value}
      </Text>
    </HStack>
  );
}
