import { HStack, Text, IconButton, useClipboard, Tooltip, Link } from '@chakra-ui/react';
import { truncateAddress } from '../lib/formatters';

export default function AddressCell({ address }) {
  const { hasCopied, onCopy } = useClipboard(address || '');
  if (!address) return <Text color="gray.500">—</Text>;

  const tonviewerUrl = `https://tonviewer.com/${address}`;

  return (
    <HStack spacing={1}>
      <Tooltip label={address} placement="top" hasArrow>
        <Link
          href={tonviewerUrl}
          isExternal
          color="brand.300"
          fontFamily="mono"
          fontSize="sm"
          _hover={{ color: 'brand.200' }}
        >
          {truncateAddress(address)}
        </Link>
      </Tooltip>
      <Tooltip label={hasCopied ? 'Copied!' : 'Copy address'} placement="top" hasArrow>
        <IconButton
          icon={<CopyIcon />}
          size="xs"
          variant="ghost"
          color="gray.500"
          _hover={{ color: 'gray.300' }}
          onClick={onCopy}
          aria-label="Copy address"
        />
      </Tooltip>
    </HStack>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
