import { useState } from 'react';
import { Box, Input, InputGroup, InputLeftElement, Spinner, Text, HStack } from '@chakra-ui/react';
import { Address } from '@ton/core';
import { fetchAccountType } from '../api/backend';
import ResultCard from './ResultCard';

function isValidAddress(v) {
  try { Address.parse(v.trim()); return true; } catch { return false; }
}

export default function AddressLookup({ graph }) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [classification, setClassification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const addr = value.trim();
    if (!addr) return;
    if (!isValidAddress(addr)) {
      setError('Invalid TON address');
      setClassification(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSubmitted(addr);
    try {
      const result = await fetchAccountType(addr);
      setClassification(result);
    } catch (err) {
      setError(err.message || 'Lookup failed');
      setClassification(null);
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    setSubmitted('');
    setClassification(null);
    setError(null);
    setValue('');
  }

  return (
    <Box className="fade-in">
      <form onSubmit={submit}>
        <InputGroup size="md">
          <InputLeftElement pointerEvents="none" color="var(--fg-faint)" h="36px" pl={3}>
            <SearchIcon />
          </InputLeftElement>
          <Input
            placeholder="Look up any TON address to check if it's part of Cocoon…"
            value={value}
            onChange={e => { setValue(e.target.value); if (error) setError(null); }}
            bg="var(--bg-elev-1)"
            border="1px solid var(--line-faint)"
            borderRadius="var(--radius)"
            h="36px"
            pl="36px"
            color="var(--fg)"
            fontFamily="var(--ff-mono)"
            fontSize="12.5px"
            _placeholder={{ color: 'var(--fg-faint)', fontFamily: 'var(--ff-sans)', fontSize: '13px' }}
            _hover={{ borderColor: 'var(--line)' }}
            _focus={{
              borderColor: 'var(--accent)',
              boxShadow: '0 0 0 3px var(--accent-wash)',
              outline: 'none',
            }}
          />
        </InputGroup>
      </form>

      {loading && (
        <HStack mt={3} px={3} py={2.5} bg="var(--bg-elev-1)" border="1px solid var(--line-faint)"
                borderRadius="var(--radius)" spacing={2.5}>
          <Spinner size="xs" color="var(--accent)" />
          <Text color="var(--fg-mid)" fontSize="12px" fontFamily="var(--ff-mono)">
            Resolving {submitted.slice(0, 16)}…
          </Text>
        </HStack>
      )}

      {error && (
        <Box mt={3} px={3} py={2.5} bg="var(--err-wash)" border="1px solid rgba(244, 63, 94, 0.3)"
             borderRadius="var(--radius)">
          <Text color="var(--err)" fontSize="12px" fontFamily="var(--ff-mono)">
            {error}
          </Text>
        </Box>
      )}

      {classification && (
        <Box mt={3}>
          <ResultCard address={submitted} classification={classification} graph={graph} onDismiss={dismiss} />
        </Box>
      )}
    </Box>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
