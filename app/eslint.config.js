import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'dev-dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, 'import-x': importX },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Schichtregeln (ARCHITECTURE §4): domain ist reine Logik; Fremddienste nur über adapters.
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domain',
              from: ['./src/app', './src/features', './src/design', './src/data', './src/adapters'],
              message: 'domain/ darf nur reine Logik enthalten.',
            },
            {
              target: './src/features',
              from: './src/adapters',
              message: 'Features nutzen Anbieter nur über ports/.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Kein dangerouslySetInnerHTML (CLAUDE.md).',
        },
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'Kein innerHTML (CLAUDE.md).',
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-*', 'dexie', 'maplibre-gl'] }],
    },
  },
  {
    files: ['*.config.{ts,js}', 'scripts/**/*.mjs', 'tests/e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
