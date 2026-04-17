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
    <Box className="fade-up-2">
      <HStack spacing={4} align="baseline" mb={3} flexWrap="wrap">
        <Text
          fontSize="11px"
          fontFamily="var(--ff-mono)"
          letterSpacing="0.24em"
          textTransform="uppercase"
          color="var(--ink-low)"
        >
          Address directory
        </Text>
        <Text
          fontFamily="var(--ff-display)"
          fontStyle="italic"
          fontSize="14px"
          color="var(--ink-mid)"
          sx={{ fontVariationSettings: '"opsz" 18, "SOFT" 80' }}
        >
          check whether any TON address is part of the network
        </Text>
      </HStack>

      <form onSubmit={submit}>
        <InputGroup size="md" maxW="100%">
          <InputLeftElement pointerEvents="none" color="var(--ink-low)" height="52px" pl={4}>
            <SearchIcon />
          </InputLeftElement>
          <Input
            placeholder="Paste any TON address…"
            value={value}
            onChange={e => { setValue(e.target.value); if (error) setError(null); }}
            bg="rgba(255, 245, 228, 0.02)"
            border="1px solid var(--line)"
            borderRadius="2px"
            height="52px"
            pl="44px"
            color="var(--ink-high)"
            fontFamily="var(--ff-mono)"
            fontSize="13px"
            _placeholder={{ color: 'var(--ink-faint)', fontStyle: 'italic', fontFamily: 'var(--ff-display)' }}
            _hover={{ borderColor: 'var(--line-strong)' }}
            _focus={{
              borderColor: 'var(--honey)',
              boxShadow: '0 0 0 1px var(--honey), 0 0 24px rgba(232, 198, 116, 0.1)',
              outline: 'none',
            }}
          />
        </InputGroup>
      </form>

      {loading && (
        <Box
          mt={3}
          px={4}
          py={3}
          bg="rgba(255, 245, 228, 0.02)"
          border="1px solid var(--line-faint)"
          borderRadius="2px"
        >
          <HStack spacing={3}>
            <Spinner size="xs" color="var(--honey)" />
            <Text color="var(--ink-mid)" fontSize="12px" fontFamily="var(--ff-mono)">
              Resolving {submitted.slice(0, 16)}…
            </Text>
          </HStack>
        </Box>
      )}

      {error && (
        <Box
          mt={3}
          px={4}
          py={3}
          bg="rgba(245, 139, 124, 0.06)"
          border="1px solid rgba(245, 139, 124, 0.35)"
          borderRadius="2px"
        >
          <Text color="var(--coral)" fontSize="13px" fontFamily="var(--ff-mono)">
            {error}
          </Text>
        </Box>
      )}

      {classification && (
        <Box mt={4}>
          <ResultCard address={submitted} classification={classification} graph={graph} onDismiss={dismiss} />
        </Box>
      )}
    </Box>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
