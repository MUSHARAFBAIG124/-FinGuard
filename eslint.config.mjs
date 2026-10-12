import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const browserGlobals = {
  alert: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  localStorage: 'readonly',
  matchMedia: 'readonly',
  navigator: 'readonly',
  performance: 'readonly',
  queueMicrotask: 'readonly',
  reportError: 'readonly',
  self: 'readonly',
  sessionStorage: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
};

const nodeGlobals = {
  Buffer: 'readonly',
  console: 'readonly',
  process: 'readonly',
  URL: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'services/ai/.venv/**',
      '**/.venv*/**',
      'apps/api/vitest-report.json',
      '**/*.coverage',
      '**/*.log',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.ts',
            '*.js',
            '*.mjs',
            '*.cjs',
            'scripts/*.ts',
            'apps/api/vitest.config.ts',
            'apps/api/scripts/*.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/shared/**/*.{ts,tsx}'],
    languageOptions: {
      globals: browserGlobals,
    },
  },
  {
    files: ['apps/api/**/*.{ts,tsx}', 'packages/shared/**/*.{ts,tsx}'],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
);
