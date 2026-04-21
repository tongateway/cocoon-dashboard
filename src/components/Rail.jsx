import { Box, VStack, Tooltip } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

// Left icon rail — matches Claude Design handoff. Items scroll to in-page sections
// for our single-page dashboard; there's no multi-page navigation.
const ITEMS = [
  { id: 'overview',   label: 'Overview',     anchor: '#overview',     icon: OverviewIcon, active: true },
  { id: 'agents',     label: 'Agents',       anchor: '#agents',       icon: AgentsIcon },
  { id: 'metrics',    label: 'Metrics',      anchor: '#metrics',      icon: MetricsIcon },
  { id: 'events',     label: 'Events',       anchor: '#events',       icon: EventsIcon },
  { id: 'lifespan',   label: 'Lifespan',     anchor: '#lifespan',     icon: LifespanIcon },
];

const BOTTOM = [
  { id: 'github',  label: 'GitHub',     href: 'https://github.com/tongateway/cocoon-dashboard', icon: GithubIcon, external: true },
  { id: 'account', label: 'Agentmeme',  to: '/address/UQBKZ9V7mBDva2kQHYXfzcC4LJwtgie1O60xxqke_-vfOM0K', icon: AccountIcon },
];

export default function Rail() {
  return (
    <Box
      as="aside"
      sx={{
        width: '56px',
        borderRight: '1px solid var(--line-soft)',
        background: 'var(--bg-0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '2px',
        position: 'sticky',
        top: 0,
        height: '100vh',
        flexShrink: 0,
      }}
    >
      <Logo />

      <VStack spacing="2px" align="center" mt="2px">
        {ITEMS.map(it => (
          <NavItem key={it.id} item={it} />
        ))}
      </VStack>

      <Box flex={1} />

      <VStack spacing="2px" align="center">
        {BOTTOM.map(it => (
          <NavItem key={it.id} item={it} />
        ))}
      </VStack>
    </Box>
  );
}

function Logo() {
  return (
    <Box
      sx={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, oklch(85% 0.18 135) 0%, oklch(78% 0.14 160) 100%)',
        display: 'grid',
        placeItems: 'center',
        marginBottom: '10px',
        color: 'var(--bg-0)',
        fontWeight: 700,
        fontSize: '15px',
        letterSpacing: '-0.03em',
      }}
    >
      C
    </Box>
  );
}

function NavItem({ item }) {
  const Icon = item.icon;
  const common = {
    sx: {
      width: '36px',
      height: '36px',
      display: 'grid',
      placeItems: 'center',
      color: item.active ? 'var(--fg-0)' : 'var(--fg-2)',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'background .12s ease, color .12s ease',
      position: 'relative',
      background: item.active ? 'var(--bg-2)' : 'transparent',
      _hover: {
        background: 'var(--bg-2)',
        color: 'var(--fg-0)',
      },
      '& svg': { width: '16px', height: '16px' },
      ...(item.active && {
        '::before': {
          content: '""',
          position: 'absolute',
          left: '-12px',
          top: '10px',
          bottom: '10px',
          width: '2px',
          background: 'var(--accent)',
          borderRadius: '0 2px 2px 0',
        },
      }),
    },
  };

  const inner = <Icon />;

  const node = item.anchor ? (
    <Box as="a" href={item.anchor} title={item.label} {...common}>{inner}</Box>
  ) : item.external ? (
    <Box as="a" href={item.href} target="_blank" rel="noopener noreferrer" title={item.label} {...common}>{inner}</Box>
  ) : item.to ? (
    <Box as={RouterLink} to={item.to} title={item.label} {...common}>{inner}</Box>
  ) : (
    <Box title={item.label} {...common}>{inner}</Box>
  );

  return (
    <Tooltip label={item.label} placement="right" hasArrow bg="var(--bg-2)" color="var(--fg-0)"
             borderColor="var(--line)" borderWidth="1px" fontSize="11px">
      {node}
    </Tooltip>
  );
}

// Icons — line style, 16x16 base
function OverviewIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
    <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
  </svg>;
}
function AgentsIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="5" r="2.5"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/>
  </svg>;
}
function MetricsIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 13h12M4 10v3M7 6v7M10 8v5M13 3v10"/>
  </svg>;
}
function EventsIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3h10M3 6h10M3 9h7M3 12h5"/>
  </svg>;
}
function LifespanIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 14l3-5 3 3 5-7"/><circle cx="14" cy="3" r="1"/>
  </svg>;
}
function GithubIcon() {
  return <svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.6 0 0 3.6 0 8c0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.7-.9-3.7-4 0-.9.3-1.6.8-2.2-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.2 0 3.1-1.9 3.8-3.7 4 .3.3.6.8.6 1.6v2.3c0 .2.1.5.6.4C13.7 14.5 16 11.5 16 8c0-4.4-3.6-8-8-8z"/>
  </svg>;
}
function AccountIcon() {
  return <Box sx={{
    width: '22px', height: '22px', borderRadius: '50%',
    background: 'linear-gradient(135deg, oklch(70% 0.1 20), oklch(60% 0.1 300))',
  }} />;
}
