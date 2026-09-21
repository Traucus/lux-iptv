module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    'react/prop-types': 'off',
    'no-console': 'warn',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'release/', 'coverage/', '*.js', '*.cjs'],
  overrides: [
    {
      files: ['src/renderer/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'electron',
                message: 'Renderer cannot import Electron. Use preload/IPC.',
              },
            ],
            patterns: [
              {
                group: ['@main', '@main/*'],
                message: 'Renderer cannot import @main.',
              },
              {
                group: ['**/src/main/**', '**/main/**'],
                message: 'Renderer cannot import src/main.',
              },
              {
                group: [
                  'node:*',
                  'fs',
                  'path',
                  'os',
                  'net',
                  'http',
                  'https',
                  'child_process',
                  'crypto',
                  'worker_threads',
                ],
                message: 'Renderer cannot import Node internals.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/shared/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'electron',
                message: 'Shared must stay platform-agnostic.',
              },
              {
                name: 'react',
                message: 'Shared cannot import React.',
              },
              {
                name: 'react-dom',
                message: 'Shared cannot import React DOM.',
              },
            ],
            patterns: [
              {
                group: ['@main', '@main/*', '@renderer', '@renderer/*'],
                message: 'Shared cannot import @main or @renderer.',
              },
              {
                group: ['**/src/main/**', '**/main/**', '**/src/renderer/**', '**/renderer/**'],
                message: 'Shared cannot import main or renderer.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/main/**/*.{ts,tsx}', 'src/main/services/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react',
                message: 'Domain/services cannot import React.',
              },
              {
                name: 'react-dom',
                message: 'Domain/services cannot import React DOM.',
              },
            ],
            patterns: [
              {
                group: ['@renderer', '@renderer/*'],
                message: 'Domain/services cannot import @renderer.',
              },
              {
                group: ['**/src/renderer/**', '**/renderer/**'],
                message: 'Domain/services cannot import renderer UI.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/licensing-api/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react',
                message: 'licensing-api cannot import React.',
              },
              {
                name: 'react-dom',
                message: 'licensing-api cannot import React DOM.',
              },
            ],
            patterns: [
              {
                group: ['@main', '@main/*', '@renderer', '@renderer/*'],
                message: 'licensing-api cannot import @main or @renderer.',
              },
              {
                group: [
                  '**/src/main/**',
                  '**/main/**',
                  '**/src/renderer/**',
                  '**/renderer/**',
                ],
                message: 'licensing-api cannot import src/main or renderer.',
              },
            ],
          },
        ],
      },
    },
  ],
};
