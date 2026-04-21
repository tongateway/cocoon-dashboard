import { useState } from 'react';
import { Box, HStack, Text, Input, InputGroup, InputLeftElement, Spinner, Tooltip } from '@chakra-ui/react';
import { Address } from '@ton/core';
import { fetchAccountType } from '../api/backend';
import ResultCard from './ResultCard';

function isValidAddress(v) { try { Address.parse(v.trim()); return true; } catch { return false; } }

export default function TopBar({ connected, lastRefresh, fallbackPoll, graph, onRefresh }) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [classification, setClassification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const addr = value.trim();
    if (!addr) return;
    if (!isValidAddress(addr)) { setError('Invalid TON address'); setClassification(null); return; }
    setLoading(true); setError(null); setSubmitted(addr);
    try { setClassification(await fetchAccountType(addr)); }
    catch (err) { setError(err.message || 'Lookup failed'); setClassification(null); }
    finally { setLoading(false); }
  }
  function dismiss() { setSubmitted(''); setClassification(null); setError(null); setValue(''); }

  return (
    <>
      <Box
        as="header"
        sx={{
          height: '48px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 20px',
          background: 'var(--bg-0)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        {/* Breadcrumbs */}
        <HStack spacing="8px" fontSize="13px">
          <Text color="var(--fg-1)">cocoon-network</Text>
          <Text color="var(--fg-3)">/</Text>
          <Text color="var(--fg-0)" fontWeight="500">overview</Text>
        </HStack>

        {/* Env pill */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '24px',
            padding: '0 8px 0 6px',
            border: '1px solid var(--line)',
            borderRadius: '999px',
            background: 'var(--bg-1)',
            fontSize: '11.5px',
            color: 'var(--fg-1)',
          }}
        >
          <Box sx={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: connected ? 'var(--accent)' : 'var(--err)',
            boxShadow: connected ? '0 0 0 3px var(--ok-ring)' : '0 0 0 3px var(--err-ring)',
          }} />
          TON mainnet
        </Box>

        {/* Fallback indicator */}
        {fallbackPoll && (
          <HStack spacing="6px" fontSize="11px">
            <Box w="6px" h="6px" borderRadius="50%" bg="var(--warn)" />
            <Text color="var(--warn)" className="mono">polling cache</Text>
          </HStack>
        )}

        <Box flex={1} />

        {/* Right — search + action buttons */}
        <HStack spacing="8px">
          <form onSubmit={submit} style={{ margin: 0 }}>
            <InputGroup size="sm">
              <InputLeftElement h="28px" w="28px" pointerEvents="none" color="var(--fg-3)">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="4.5"/><path d="M13 13l-2.5-2.5"/>
                </svg>
              </InputLeftElement>
              <Input
                placeholder="Search address…"
                value={value}
                onChange={e => { setValue(e.target.value); if (error) setError(null); }}
                sx={{
                  width: '260px',
                  height: '28px',
                  padding: '0 10px 0 28px',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  background: 'var(--bg-1)',
                  color: 'var(--fg-0)',
                  fontSize: '12px',
                  fontFamily: 'var(--ff-mono)',
                  _placeholder: { color: 'var(--fg-3)', fontFamily: 'var(--ff-sans)' },
                  _hover: { background: 'var(--bg-2)' },
                  _focus: {
                    outline: 'none',
                    borderColor: 'var(--accent)',
                    boxShadow: '0 0 0 3px var(--ok-ring)',
                  },
                }}
              />
            </InputGroup>
          </form>

          <Tooltip label="Refresh data" placement="bottom" hasArrow bg="var(--bg-2)" color="var(--fg-0)"
                   borderColor="var(--line)" borderWidth="1px" fontSize="11px">
            <Box as="button" onClick={onRefresh}
                 sx={{
                   width: '28px', height: '28px', display: 'grid', placeItems: 'center',
                   border: '1px solid var(--line)', borderRadius: '6px',
                   background: 'var(--bg-1)', color: 'var(--fg-1)', cursor: 'pointer',
                   _hover: { background: 'var(--bg-2)', color: 'var(--fg-0)' },
                 }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8a5 5 0 019-3l1 1M13 8a5 5 0 01-9 3l-1-1M12 3v3h-3M4 13v-3h3"/>
              </svg>
            </Box>
          </Tooltip>

          {lastRefresh && (
            <Text fontSize="11px" color="var(--fg-3)" className="mono" display={{ base: 'none', md: 'block' }}>
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </HStack>
      </Box>

      {/* Address-lookup result surfaces below the topbar, like a full-width command bar output */}
      {(loading || error || classification) && (
        <Box sx={{ padding: '12px 28px', borderBottom: '1px solid var(--line-soft)' }}>
          {loading && (
            <HStack spacing="10px" color="var(--fg-1)" fontSize="12px">
              <Spinner size="xs" color="var(--accent)" />
              <Text className="mono">Resolving {submitted.slice(0, 16)}…</Text>
            </HStack>
          )}
          {error && (
            <Box sx={{
              padding: '10px 12px',
              background: 'var(--err-wash)',
              border: '1px solid var(--err-edge)',
              borderRadius: 'var(--radius)',
            }}>
              <Text color="var(--err)" fontSize="12.5px" className="mono">{error}</Text>
            </Box>
          )}
          {classification && (
            <ResultCard address={submitted} classification={classification} graph={graph} onDismiss={dismiss} />
          )}
        </Box>
      )}
    </>
  );
}
