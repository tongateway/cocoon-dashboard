import {
  SimpleGrid, Box, HStack, VStack, Text, Tabs, TabList, TabPanels, TabPanel, Tab,
  Divider, Code, Tooltip,
} from '@chakra-ui/react';
import AddressCell from './AddressCell';
import { nanoToTon, timeAgo } from '../lib/formatters';

const byBalanceDesc = (a, b) => parseInt(b?.balance || '0', 10) - parseInt(a?.balance || '0', 10);

// Tone map for contract kinds
const TONES = {
  proxy:  'var(--plum)',
  client: 'var(--dusk)',
  worker: 'var(--honey)',
  wallet: 'var(--mint)',
  root:   'var(--honey)',
};

export default function ProxyCards({ rootConfig, proxies, clients, workers, cocoonWallets }) {
  const proxyList  = proxies       ? [...proxies.values()].sort(byBalanceDesc)       : [];
  const clientList = clients       ? [...clients.values()].sort(byBalanceDesc)       : [];
  const workerList = workers       ? [...workers.values()].sort(byBalanceDesc)       : [];
  const walletList = cocoonWallets ? [...cocoonWallets.values()].sort(byBalanceDesc) : [];

  return (
    <Box className="fade-up">
      <HStack spacing={4} align="baseline" flexWrap="wrap" mb={4}>
        <Text fontSize="11px" fontFamily="var(--ff-mono)" letterSpacing="0.24em" textTransform="uppercase" color="var(--ink-low)">
          § VI · Network topology
        </Text>
        <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="16px" color="var(--ink-mid)"
              sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}>
          every discovered contract, sorted by balance
        </Text>
      </HStack>

      <Box borderTop="1px solid var(--line-faint)" pt={4}>
        <Tabs variant="unstyled" size="sm">
          <TabList mb={5} gap={0} flexWrap="wrap" borderBottom="1px solid var(--line-faint)">
            {rootConfig && <EditorialTab tone={TONES.root}>Root</EditorialTab>}
            <EditorialTab tone={TONES.proxy}>Proxies · {proxyList.length}</EditorialTab>
            <EditorialTab tone={TONES.client}>Clients · {clientList.length}</EditorialTab>
            <EditorialTab tone={TONES.worker}>Workers · {workerList.length}</EditorialTab>
            {walletList.length > 0 && <EditorialTab tone={TONES.wallet}>Cocoon wallets · {walletList.length}</EditorialTab>}
          </TabList>

          <TabPanels>
            {rootConfig && (
              <TabPanel p={0}>
                <RootConfigPanel rootConfig={rootConfig} />
              </TabPanel>
            )}

            <TabPanel p={0}>
              {proxyList.length === 0 ? <Empty text="Discovering proxies…" /> : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={0}
                  sx={{ borderTop: '1px solid var(--line-faint)', '& > *': { borderRight: '1px solid var(--line-faint)', borderBottom: '1px solid var(--line-faint)' } }}>
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
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={0}
                  sx={{ borderTop: '1px solid var(--line-faint)', '& > *': { borderRight: '1px solid var(--line-faint)', borderBottom: '1px solid var(--line-faint)' } }}>
                  {clientList.map(c => (
                    <ContractCard key={c.address} address={c.address} balance={c.balance} kind="client" tone={TONES.client}
                      proxyAddress={c.proxyAddress} />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>

            <TabPanel p={0}>
              {workerList.length === 0 ? <Empty text="No workers discovered yet" /> : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={0}
                  sx={{ borderTop: '1px solid var(--line-faint)', '& > *': { borderRight: '1px solid var(--line-faint)', borderBottom: '1px solid var(--line-faint)' } }}>
                  {workerList.map(w => (
                    <ContractCard key={w.address} address={w.address} balance={w.balance} kind="worker" tone={TONES.worker}
                      proxyAddress={w.proxyAddress} />
                  ))}
                </SimpleGrid>
              )}
            </TabPanel>

            {walletList.length > 0 && (
              <TabPanel p={0}>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={0}
                  sx={{ borderTop: '1px solid var(--line-faint)', '& > *': { borderRight: '1px solid var(--line-faint)', borderBottom: '1px solid var(--line-faint)' } }}>
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
    </Box>
  );
}

function EditorialTab({ children, tone = 'var(--ink-high)' }) {
  return (
    <Tab
      px={5}
      py={3}
      borderBottom="2px solid transparent"
      color="var(--ink-low)"
      fontFamily="var(--ff-mono)"
      fontSize="11px"
      letterSpacing="0.14em"
      textTransform="uppercase"
      fontWeight="500"
      _selected={{
        color: tone,
        borderColor: tone,
        fontWeight: '500',
      }}
      _hover={{ color: tone }}
      sx={{ transition: 'color 150ms var(--ease-soft), border-color 150ms var(--ease-soft)' }}
    >
      {children}
    </Tab>
  );
}

function Empty({ text }) {
  return (
    <Box py={10} textAlign="center" borderTop="1px solid var(--line-faint)">
      <Text fontFamily="var(--ff-display)" fontStyle="italic" fontSize="15px" color="var(--ink-low)"
            sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}>
        {text}
      </Text>
    </Box>
  );
}

function ContractCard({ address, balance, state, lastActivity, kind, tone, extras, proxyAddress }) {
  return (
    <Box
      p={5}
      position="relative"
      _hover={{ bg: 'rgba(255, 245, 228, 0.015)' }}
      sx={{ transition: 'background 150ms var(--ease-soft)' }}
    >
      <HStack justify="space-between" mb={3}>
        <Text fontSize="10px" fontFamily="var(--ff-mono)" color={tone}
              letterSpacing="0.16em" textTransform="uppercase" fontWeight="500">
          {kind}
        </Text>
        {state && (
          <Text fontSize="10px" fontFamily="var(--ff-mono)" letterSpacing="0.12em"
                color={state === 'active' ? 'var(--mint)' : 'var(--coral)'}>
            {state === 'active' ? '◆ active' : '◇ ' + state}
          </Text>
        )}
      </HStack>

      <AddressCell address={address} />

      {proxyAddress && (
        <HStack mt={2} spacing={2}>
          <Text fontSize="10px" fontFamily="var(--ff-display)" fontStyle="italic" color="var(--ink-low)"
                sx={{ fontVariationSettings: '"opsz" 12, "SOFT" 80' }}>
            via
          </Text>
          <AddressCell address={proxyAddress} />
        </HStack>
      )}

      <HStack mt={4} spacing={6} align="baseline">
        {balance && (
          <VStack spacing={0} align="start">
            <Text fontSize="9px" fontFamily="var(--ff-body)" letterSpacing="0.2em" textTransform="uppercase"
                  color="var(--ink-faint)" fontWeight="500">
              Balance
            </Text>
            <Text fontFamily="var(--ff-display)" fontSize="22px" color="var(--ink-high)" fontWeight="400"
                  sx={{ fontVariationSettings: '"opsz" 32, "SOFT" 30', letterSpacing: '-0.015em' }}>
              {nanoToTon(balance).toFixed(2)}
              <Box as="span" fontSize="11px" color="var(--ink-low)" ml={1} fontFamily="var(--ff-body)">TON</Box>
            </Text>
          </VStack>
        )}
        {extras?.map(ex => (
          <VStack key={ex.label} spacing={0} align="start">
            <Text fontSize="9px" fontFamily="var(--ff-body)" letterSpacing="0.2em" textTransform="uppercase"
                  color="var(--ink-faint)" fontWeight="500">
              {ex.label}
            </Text>
            <Text fontFamily="var(--ff-display)" fontSize="22px" color="var(--ink-mid)" fontWeight="400"
                  sx={{ fontVariationSettings: '"opsz" 32, "SOFT" 30' }}>
              {ex.value}
            </Text>
          </VStack>
        ))}
        {lastActivity ? (
          <VStack spacing={0} align="start" ml="auto">
            <Text fontSize="9px" fontFamily="var(--ff-body)" letterSpacing="0.2em" textTransform="uppercase"
                  color="var(--ink-faint)" fontWeight="500">
              Last
            </Text>
            <Text fontFamily="var(--ff-mono)" fontSize="12px" color="var(--ink-low)">
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
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={0}
      borderTop="1px solid var(--line-faint)"
      sx={{ '& > *': { borderRight: { lg: '1px solid var(--line-faint)' }, borderBottom: '1px solid var(--line-faint)' },
            '& > *:nth-of-type(2n)': { borderRight: 'none' } }}>
      <Panel title="Pricing">
        <ConfigRow label="Price per token" value={`${rootConfig.pricePerToken} nanoTON`} />
        <ConfigRow label="Worker fee per token" value={`${rootConfig.workerFeePerToken} nanoTON`} />
        <ConfigRow label="Proxy margin" value={`${rootConfig.pricePerToken - rootConfig.workerFeePerToken} nanoTON/token`} />
        <Divider borderColor="var(--line-faint)" />
        <ConfigRow label="Prompt multiplier" value={`${(rootConfig.promptMultiplier / 10000).toFixed(1)}×`} />
        <ConfigRow label="Cached multiplier" value={`${(rootConfig.cachedMultiplier / 10000).toFixed(1)}×`} />
        <ConfigRow label="Completion multiplier" value={`${(rootConfig.completionMultiplier / 10000).toFixed(1)}×`} />
        <ConfigRow label="Reasoning multiplier" value={`${(rootConfig.reasoningMultiplier / 10000).toFixed(1)}×`} />
      </Panel>

      <Panel title="Network config">
        <HStack justify="space-between">
          <Text fontSize="11px" color="var(--ink-low)" fontFamily="var(--ff-body)" letterSpacing="0.08em">Owner</Text>
          <AddressCell address={rootConfig.owner} />
        </HStack>
        <ConfigRow label="Struct version" value={rootConfig.structVersion} />
        <ConfigRow label="Params version" value={rootConfig.paramsVersion} />
        <ConfigRow label="Test mode" value={rootConfig.isTest ? 'Yes' : 'No'} />
        <ConfigRow label="Last proxy seqno" value={rootConfig.lastProxySeqno} />
        <Divider borderColor="var(--line-faint)" />
        <ConfigRow label="Min proxy stake" value={`${(rootConfig.minProxyStake / 1e9).toFixed(0)} TON`} />
        <ConfigRow label="Min client stake" value={`${(rootConfig.minClientStake / 1e9).toFixed(0)} TON`} />
        <ConfigRow label="Proxy close delay" value={`${rootConfig.proxyDelayBeforeClose / 3600}h`} />
        <ConfigRow label="Client close delay" value={`${rootConfig.clientDelayBeforeClose / 3600}h`} />
      </Panel>

      {rootConfig.proxyIPs?.length > 0 && (
        <Panel title="Registered proxy endpoints">
          <VStack spacing={2} align="stretch">
            {rootConfig.proxyIPs.map((ip, i) => (
              <HStack key={i} spacing={2}>
                <Text fontSize="9px" fontFamily="var(--ff-mono)" color={ip.startsWith('!') ? 'var(--honey)' : 'var(--dusk)'}
                      letterSpacing="0.12em" textTransform="uppercase">
                  {ip.startsWith('!') ? '[workers]' : '[clients]'}
                </Text>
                <Code fontSize="13px" bg="transparent" color="var(--ink-mid)" fontFamily="var(--ff-mono)" p={0}>
                  {ip.replace(/^!/, '')}
                </Code>
              </HStack>
            ))}
          </VStack>
        </Panel>
      )}

      <Panel title="Token economics">
        <Tooltip label="Cost for 1M prompt tokens" hasArrow>
          <HStack justify="space-between" cursor="help">
            <Text fontSize="11px" color="var(--ink-low)">1M prompt tokens</Text>
            <Text fontFamily="var(--ff-display)" fontSize="17px" color="var(--ink-high)"
              sx={{ fontVariationSettings: '"opsz" 20, "SOFT" 30' }}>
              {((rootConfig.pricePerToken * rootConfig.promptMultiplier / 10000) * 1e6 / 1e9).toFixed(4)} TON
            </Text>
          </HStack>
        </Tooltip>
        <Tooltip label="Cost for 1M completion tokens" hasArrow>
          <HStack justify="space-between" cursor="help">
            <Text fontSize="11px" color="var(--ink-low)">1M completion tokens</Text>
            <Text fontFamily="var(--ff-display)" fontSize="17px" color="var(--ink-high)"
              sx={{ fontVariationSettings: '"opsz" 20, "SOFT" 30' }}>
              {((rootConfig.pricePerToken * rootConfig.completionMultiplier / 10000) * 1e6 / 1e9).toFixed(4)} TON
            </Text>
          </HStack>
        </Tooltip>
        <Tooltip label="Cost for 1M reasoning tokens" hasArrow>
          <HStack justify="space-between" cursor="help">
            <Text fontSize="11px" color="var(--ink-low)">1M reasoning tokens</Text>
            <Text fontFamily="var(--ff-display)" fontSize="17px" color="var(--ink-high)"
              sx={{ fontVariationSettings: '"opsz" 20, "SOFT" 30' }}>
              {((rootConfig.pricePerToken * rootConfig.reasoningMultiplier / 10000) * 1e6 / 1e9).toFixed(4)} TON
            </Text>
          </HStack>
        </Tooltip>
        <Tooltip label="Cost for 1M cached tokens" hasArrow>
          <HStack justify="space-between" cursor="help">
            <Text fontSize="11px" color="var(--ink-low)">1M cached tokens</Text>
            <Text fontFamily="var(--ff-display)" fontSize="17px" color="var(--ink-high)"
              sx={{ fontVariationSettings: '"opsz" 20, "SOFT" 30' }}>
              {((rootConfig.pricePerToken * rootConfig.cachedMultiplier / 10000) * 1e6 / 1e9).toFixed(4)} TON
            </Text>
          </HStack>
        </Tooltip>
      </Panel>
    </SimpleGrid>
  );
}

function Panel({ title, children }) {
  return (
    <Box p={5}>
      <Text fontSize="10px" fontFamily="var(--ff-body)" letterSpacing="0.22em" textTransform="uppercase"
            color="var(--honey)" fontWeight="500" mb={4}>
        {title}
      </Text>
      <VStack spacing={2} align="stretch">{children}</VStack>
    </Box>
  );
}

function ConfigRow({ label, value }) {
  return (
    <HStack justify="space-between" align="baseline">
      <Text fontSize="11px" color="var(--ink-low)" fontFamily="var(--ff-body)" letterSpacing="0.01em">
        {label}
      </Text>
      <Text fontFamily="var(--ff-mono)" fontSize="12px" color="var(--ink-high)" fontWeight="500">
        {value}
      </Text>
    </HStack>
  );
}
