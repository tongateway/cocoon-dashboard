import { extendTheme } from '@chakra-ui/react';

// Editorial Bioluminescent Terminal — Chakra tokens bridged to CSS vars in global.css.
// When possible, prefer CSS vars directly in components (see global.css).

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  fonts: {
    heading: "'Fraunces', Georgia, serif",
    body:    "'Geist', -apple-system, sans-serif",
    mono:    "'JetBrains Mono', ui-monospace, monospace",
  },
  styles: {
    global: {
      body: {
        bg: 'var(--bg-base)',
        color: 'var(--ink-high)',
      },
    },
  },
  colors: {
    brand: {
      50:  '#fff6e2',
      100: '#fce6ba',
      200: '#f5d58e',
      300: '#eec461',
      400: '#e8c674',
      500: '#d4a94f',
      600: '#b28a36',
      700: '#8c6926',
      800: '#66491a',
      900: '#402c0f',
    },
    mint:  { 400: '#82d5a7' },
    coral: { 400: '#f58b7c' },
    dusk:  { 400: '#8ab0d1' },
    plum:  { 400: '#c88bc4' },
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          bg: 'transparent',
          borderColor: 'var(--line)',
          borderWidth: '1px',
          borderRadius: '0',
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: { borderColor: 'var(--line-faint)', color: 'var(--ink-low)' },
          td: { borderColor: 'var(--line-faint)' },
        },
      },
    },
  },
});

export default theme;
