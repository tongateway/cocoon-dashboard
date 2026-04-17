import { HStack, Text, IconButton, useClipboard, Tooltip, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { truncateAddress } from '../lib/formatters';

export default function AddressCell({ address }) {
  const { hasCopied, onCopy } = useClipboard(address || '');
  if (!address) return <Text color="var(--ink-faint)">—</Text>;

  return (
    <HStack spacing={1}>
      <Tooltip label={address} placement="top" hasArrow bg="var(--bg-void)" color="var(--ink-high)"
               borderColor="var(--line)" borderWidth="1px">
        <Link
          as={RouterLink}
          to={`/address/${encodeURIComponent(address)}`}
          color="var(--ink-mid)"
          fontFamily="var(--ff-mono)"
          fontSize="13px"
          letterSpacing="-0.005em"
          _hover={{ color: 'var(--honey)' }}
          sx={{ transition: 'color 150ms var(--ease-soft)', borderBottom: '1px dotted var(--line)' }}
        >
          {truncateAddress(address)}
        </Link>
      </Tooltip>
      <Tooltip label={hasCopied ? 'Copied' : 'Copy'} placement="top" hasArrow
               bg="var(--bg-void)" color="var(--ink-high)" borderColor="var(--line)" borderWidth="1px">
        <IconButton
          icon={<CopyIcon />}
          size="xs"
          variant="ghost"
          color="var(--ink-faint)"
          _hover={{ color: 'var(--honey)', bg: 'transparent' }}
          onClick={onCopy}
          aria-label="Copy address"
          minW="18px"
          h="18px"
        />
      </Tooltip>
    </HStack>
  );
}

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
