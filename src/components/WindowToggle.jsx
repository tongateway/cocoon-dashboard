import { HStack, Box } from '@chakra-ui/react';

// eslint-disable-next-line react-refresh/only-export-components
export const WINDOWS = [
  { id: '1h',  label: '1h',  ms: 60 * 60 * 1000 },
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d',  label: '7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All', ms: Infinity },
];

export default function WindowToggle({ value, onChange }) {
  return (
    <HStack
      spacing={0}
      border="1px solid var(--line-faint)"
      borderRadius="var(--radius-sm)"
      bg="var(--bg-elev-1)"
      p="2px"
    >
      {WINDOWS.map((w) => {
        const active = value === w.id;
        return (
          <Box
            as="button"
            key={w.id}
            onClick={() => onChange(w.id)}
            px={2.5}
            h="24px"
            minW="36px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontFamily="var(--ff-mono)"
            fontSize="11px"
            fontWeight="500"
            color={active ? 'var(--fg)' : 'var(--fg-dim)'}
            bg={active ? 'var(--bg-elev-2)' : 'transparent'}
            borderRadius="3px"
            border="1px solid"
            borderColor={active ? 'var(--line)' : 'transparent'}
            _hover={{ color: 'var(--fg)' }}
            sx={{ transition: 'all 120ms var(--ease)', cursor: 'pointer' }}
          >
            {w.label}
          </Box>
        );
      })}
    </HStack>
  );
}
