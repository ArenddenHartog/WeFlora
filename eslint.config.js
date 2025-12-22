import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      'dist/**',
      '.vercel/**',
      'node_modules/**',
      'backend/**',
      'archive/**',
      'restore/**',
      'scripts/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // Keep scope intentionally narrow: hooks enforcement only.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // Enforce correct Rules of Hooks usage
      'react-hooks/rules-of-hooks': 'error',
      // Warn on missing deps (kept warn to reduce churn)
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

