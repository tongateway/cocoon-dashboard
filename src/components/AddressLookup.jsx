import { useState } from 'react';
import { Box, Input, InputGroup, InputLeftElement, Spinner, Text } from '@chakra-ui/react';
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
    <Box>
      <form onSubmit={submit}>
        <InputGroup size="md" maxW={{ base: '100%', md: '520px' }}>
          <InputLeftElement pointerEvents="none" color="gray.500">
            <SearchIcon />
          </InputLeftElement>
          <Input
            placeholder="Paste any TON address to check if it's part of Cocoon…"
            value={value}
            onChange={e => { setValue(e.target.value); if (error) setError(null); }}
            bg="#0d1117" border="1px solid #30363d" borderRadius="lg"
            color="#e6edf3" fontFamily="mono" fontSize="12px"
            _placeholder={{ color: '#7d8590' }}
            _hover={{ borderColor: '#484f58' }}
            _focus={{ borderColor: '#3fb950', boxShadow: '0 0 0 1px #3fb950' }}
          />
        </InputGroup>
      </form>

      {loading && (
        <Box mt={3} p={3} bg="#161b22" border="1px solid #30363d" borderRadius="lg">
          <Spinner size="sm" color="#3fb950" mr={2} /> <Text as="span" color="#8b949e" fontSize="13px">Resolving {submitted.slice(0, 10)}…</Text>
        </Box>
      )}
      {error && (
        <Box mt={3} p={3} bg="rgba(248,81,73,0.1)" border="1px solid rgba(248,81,73,0.4)" borderRadius="lg">
          <Text color="#f85149" fontSize="13px">{error}</Text>
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
