import { HStack, Text, IconButton, useClipboard, Tooltip, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { truncateAddress } from '../lib/formatters';

export default function AddressCell({ address }) {
  const { hasCopied, onCopy } = useClipboard(address || '');
  if (!address) return <Text color="var(--fg-faint)">—</Text>;

  return (
    <HStack spacing={1}>
      <Tooltip label={address} placement="top" hasArrow bg="var(--bg-elev-2)" color="var(--fg)"
               borderColor="var(--line)" borderWidth="1px" fontSize="11px" fontFamily="var(--ff-mono)">
        <Link
          as={RouterLink}
          to={`/address/${encodeURIComponent(address)}`}
          color="var(--fg-mid)"
          fontFamily="var(--ff-mono)"
          fontSize="12px"
          _hover={{ color: 'var(--accent)' }}
          sx={{ transition: 'color 120ms var(--ease)' }}
        >
          {truncateAddress(address)}
        </Link>
      </Tooltip>
      <Tooltip label={hasCopied ? 'Copied' : 'Copy'} placement="top" hasArrow
               bg="var(--bg-elev-2)" color="var(--fg)" borderColor="var(--line)" borderWidth="1px" fontSize="11px">
        <IconButton
          icon={<CopyIcon />}
          size="xs"
          variant="ghost"
          color="var(--fg-faint)"
          _hover={{ color: 'var(--fg)', bg: 'transparent' }}
          onClick={onCopy}
          aria-label="Copy"
          minW="16px"
          h="16px"
        />
      </Tooltip>
    </HStack>
  );
}

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
