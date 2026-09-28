import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['server/index.js', 'scripts/reset-data.js'],
    rules: {
      'no-console': 'off'
    }
  }
];
