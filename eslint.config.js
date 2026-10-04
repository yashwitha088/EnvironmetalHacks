import {defineConfig} from 'eslint/config';

const browserGlobals = {
  document: 'readonly',
  window: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  URLSearchParams: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  HTMLElement: 'readonly',
  L: 'readonly'
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  fetch: 'readonly'
};

export default defineConfig([
  {
    ignores: ['dist/**', 'uploads/**', 'data/**', 'node_modules/**']
  },
  {
    files: ['app.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', {args: 'none'}],
      'no-console': 'off'
    }
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ignores: ['app.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', {args: 'none'}],
      'no-console': 'off'
    }
  }
]);
