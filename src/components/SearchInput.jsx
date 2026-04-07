import { useState } from 'react';
import { InputGroup, Input, InputRightElement, IconButton } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

export default function SearchInput() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    const addr = value.trim();
    if (addr) {
      navigate(`/address/${encodeURIComponent(addr)}`);
      setValue('');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputGroup size="sm" w={{ base: '200px', md: '320px' }}>
        <Input
          placeholder="Search address..."
          value={value}
          onChange={e => setValue(e.target.value)}
          bg="#161b22"
          border="1px solid #30363d"
          borderRadius="lg"
          color="white"
          fontSize="sm"
          _placeholder={{ color: 'gray.500' }}
          _hover={{ borderColor: '#484f58' }}
          _focus={{ borderColor: 'brand.400', boxShadow: '0 0 0 1px #38B2AC' }}
        />
        <InputRightElement>
          <IconButton
            type="submit"
            icon={<SearchIcon />}
            size="xs"
            variant="ghost"
            color="gray.400"
            _hover={{ color: 'white' }}
            aria-label="Search address"
          />
        </InputRightElement>
      </InputGroup>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
