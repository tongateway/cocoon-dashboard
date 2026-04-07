import { SimpleGrid, Card, CardBody, Stat, StatLabel, StatNumber, StatHelpText, Flex, Box } from '@chakra-ui/react';

const cards = [
  {
    key: 'totalBalance',
    label: 'Network Balance',
    format: v => `${v.toFixed(2)} TON`,
    icon: WalletIcon,
    color: 'teal.400',
  },
  {
    key: 'proxyCount',
    label: 'Active Proxies',
    format: v => String(v),
    icon: ServerIcon,
    color: 'purple.400',
  },
  {
    key: 'clientCount',
    label: 'Active Clients',
    format: v => String(v),
    icon: UsersIcon,
    color: 'cyan.400',
  },
  {
    key: 'workerCount',
    label: 'Active Workers',
    format: v => String(v),
    icon: CpuIcon,
    color: 'orange.400',
  },
];

export default function StatsCards({ stats }) {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
      {cards.map(card => (
        <Card key={card.key} overflow="hidden">
          <CardBody>
            <Flex justify="space-between" align="flex-start">
              <Stat>
                <StatLabel color="gray.400" fontSize="sm">{card.label}</StatLabel>
                <StatNumber color="white" fontSize="2xl" mt={1}>
                  {stats ? card.format(stats[card.key]) : '—'}
                </StatNumber>
                <StatHelpText color="gray.500" fontSize="xs" mb={0}>
                  {card.key === 'totalBalance' && stats
                    ? `${stats.totalTonFlow.toFixed(2)} TON total flow`
                    : '\u00A0'}
                </StatHelpText>
              </Stat>
              <Box p={2} borderRadius="lg" bg="whiteAlpha.50">
                <card.icon color={card.color} />
              </Box>
            </Flex>
          </CardBody>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function WalletIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" />
      <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

function ServerIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function UsersIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function CpuIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}
