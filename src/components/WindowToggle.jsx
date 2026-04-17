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
      border="1px solid var(--line)"
      borderRadius="2px"
      overflow="hidden"
      height="28px"
    >
      {WINDOWS.map((w, i) => {
        const active = value === w.id;
        return (
          <Box
            as="button"
            key={w.id}
            onClick={() => onChange(w.id)}
            px={3}
            h="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            minW="38px"
            fontFamily="var(--ff-mono)"
            fontSize="11px"
            fontWeight="500"
            letterSpacing="0.05em"
            color={active ? 'var(--bg-void)' : 'var(--ink-mid)'}
            bg={active ? 'var(--honey)' : 'transparent'}
            borderLeft={i === 0 ? 'none' : '1px solid var(--line-faint)'}
            _hover={{ color: active ? 'var(--bg-void)' : 'var(--ink-high)',
                      bg: active ? 'var(--honey)' : 'rgba(232, 198, 116, 0.06)' }}
            sx={{ transition: 'all 150ms var(--ease-soft)', cursor: 'pointer' }}
          >
            {w.label}
          </Box>
        );
      })}
    </HStack>
  );
}
