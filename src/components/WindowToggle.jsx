import { HStack, Box } from '@chakra-ui/react';

// eslint-disable-next-line react-refresh/only-export-components
export const WINDOWS = [
  { id: '1h',  label: '1H',  ms: 60 * 60 * 1000 },
  { id: '24h', label: '24H', ms: 24 * 60 * 60 * 1000 },
  { id: '7d',  label: '7D',  ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'ALL', ms: Infinity },
];

export default function WindowToggle({ value, onChange }) {
  return (
    <HStack
      spacing={0}
      sx={{
        display: 'inline-flex',
        border: '1px solid var(--line)',
        borderRadius: '6px',
        background: 'var(--bg-1)',
        padding: '2px',
        height: '28px',
      }}
    >
      {WINDOWS.map((w) => {
        const active = value === w.id;
        return (
          <Box
            as="button"
            key={w.id}
            onClick={() => onChange(w.id)}
            sx={{
              background: active ? 'var(--bg-3)' : 'transparent',
              border: 0,
              color: active ? 'var(--fg-0)' : 'var(--fg-2)',
              fontSize: '11.5px',
              fontWeight: 500,
              padding: '0 10px',
              height: '100%',
              borderRadius: '4px',
              cursor: 'pointer',
              _hover: { color: 'var(--fg-0)' },
              transition: 'background 120ms var(--ease), color 120ms var(--ease)',
            }}
          >
            {w.label}
          </Box>
        );
      })}
    </HStack>
  );
}
