import { HStack, Text, IconButton, useClipboard, Tooltip, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { truncateAddress } from '../lib/formatters';

export default function AddressCell({ address }) {
  const { hasCopied, onCopy } = useClipboard(address || '');
  if (!address) return <Text color="var(--fg-3)">—</Text>;

  return (
    <HStack spacing="2px">
      <Tooltip label={address} placement="top" hasArrow
               bg="var(--bg-2)" color="var(--fg-0)"
               borderColor="var(--line)" borderWidth="1px" fontSize="11px" fontFamily="var(--ff-mono)">
        <Link
          as={RouterLink}
          to={`/address/${encodeURIComponent(address)}`}
          sx={{
            color: 'var(--fg-1)',
            fontFamily: 'var(--ff-mono)',
            fontSize: '12px',
            _hover: { color: 'var(--accent)', textDecoration: 'none' },
            transition: 'color 120ms var(--ease)',
          }}
        >
          {truncateAddress(address)}
        </Link>
      </Tooltip>
      <Tooltip label={hasCopied ? 'Copied' : 'Copy'} placement="top" hasArrow
               bg="var(--bg-2)" color="var(--fg-0)"
               borderColor="var(--line)" borderWidth="1px" fontSize="11px">
        <IconButton
          icon={<CopyIcon />}
          size="xs"
          variant="ghost"
          sx={{
            color: 'var(--fg-3)',
            minW: '16px', h: '16px',
            _hover: { color: 'var(--fg-0)', background: 'transparent' },
          }}
          onClick={(e) => { e.stopPropagation(); onCopy(); }}
          aria-label="Copy address"
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
