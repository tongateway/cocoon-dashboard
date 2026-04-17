import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  fonts: {
    heading: "'Geist', -apple-system, sans-serif",
    body:    "'Geist', -apple-system, sans-serif",
    mono:    "'JetBrains Mono', ui-monospace, monospace",
  },
  styles: {
    global: {
      body: {
        bg: 'var(--bg)',
        color: 'var(--fg)',
      },
    },
  },
  colors: {
    brand: {
      50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
      400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
      800: '#166534', 900: '#14532d',
    },
  },
});

export default theme;
