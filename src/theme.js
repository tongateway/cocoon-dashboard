import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  fonts: {
    heading: "'Inter', -apple-system, sans-serif",
    body:    "'Inter', -apple-system, sans-serif",
    mono:    "'JetBrains Mono', ui-monospace, monospace",
  },
  styles: {
    global: {
      body: {
        bg: 'var(--bg-0)',
        color: 'var(--fg-0)',
      },
    },
  },
});

export default theme;
