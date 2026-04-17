import { HStack, Button } from '@chakra-ui/react';

export const WINDOWS = [
  { id: '1h',  label: '1h',  ms: 60 * 60 * 1000 },
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d',  label: '7d',  ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'All', ms: Infinity },
];

export default function WindowToggle({ value, onChange }) {
  return (
    <HStack spacing={1}>
      {WINDOWS.map(w => (
        <Button
          key={w.id}
          size="xs"
          variant={value === w.id ? 'solid' : 'ghost'}
          bg={value === w.id ? 'rgba(63,185,80,0.15)' : 'transparent'}
          color={value === w.id ? '#3fb950' : 'gray.400'}
          borderWidth="1px"
          borderColor={value === w.id ? 'rgba(63,185,80,0.35)' : '#30363d'}
          borderRadius="md"
          _hover={{ bg: value === w.id ? 'rgba(63,185,80,0.2)' : '#21262d' }}
          onClick={() => onChange(w.id)}
          fontWeight="500"
          fontSize="xs"
          px={3}
        >
          {w.label}
        </Button>
      ))}
    </HStack>
  );
}
