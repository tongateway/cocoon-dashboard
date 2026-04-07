import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: '#0d1117',
        color: 'gray.100',
      },
    },
  },
  colors: {
    brand: {
      50: '#e6fffa',
      100: '#b2f5ea',
      200: '#81e6d9',
      300: '#4fd1c5',
      400: '#38B2AC',
      500: '#319795',
      600: '#2C7A7B',
      700: '#285E61',
      800: '#234E52',
      900: '#1D4044',
    },
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          bg: '#161b22',
          borderColor: '#30363d',
          borderWidth: '1px',
          borderRadius: 'xl',
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: { borderColor: '#30363d', color: 'gray.400' },
          td: { borderColor: '#30363d' },
        },
      },
    },
  },
});

export default theme;
