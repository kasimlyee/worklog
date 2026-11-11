// @ts-check
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

/* ---------------------------------------------------------------------------
 * Import rules shared by every file.
 *  - Relative imports only within the same folder, with an explicit extension.
 *  - Everything else goes through the "#src/…" subpath import.
 * ------------------------------------------------------------------------- */
const baseImportPatterns = [
  {
    regex: '^\\.\\./',
    message: 'Import from another folder through "#src/…", not "../".',
  },
  {
    regex: '^\\./.*(?<!\\.(ts|tsx|css|json))$',
    message: 'Relative imports need an explicit file extension (e.g. "./calendar.ts").',
  },
];

const framework = ['next', 'next/*', 'react', 'react-dom', 'react/*', 'react-dom/*'];
const dataAccess = ['kysely', 'kysely/*', 'pg'];

/**
 * Builds the import restriction for one architectural layer
 * (docs/02-architecture.md §3.2).
 * Layers are matched with regexes because "#" starts a comment in gitignore-style globs.
 * @param {{ layers?: string[], packages?: string[], reason: string }} options
 */
const restrictImports = ({ layers = [], packages = [], reason }) => [
  'error',
  {
    patterns: [
      ...baseImportPatterns,
      ...(layers.length > 0
        ? [{ regex: `^#src/(${layers.join('|')})(/|$)`, message: reason }]
        : []),
      ...(packages.length > 0 ? [{ group: packages, message: reason }] : []),
    ],
  },
];

/* ---------------------------------------------------------------------------
 * Syntax bans (docs/03-engineering-standards.md §4–§6).
 * ------------------------------------------------------------------------- */
const bannedSyntax = [
  {
    selector: "MemberExpression[object.name='sql'][property.name='raw']",
    message: 'sql.raw is banned. Use the sql`` template tag. Constant-only uses need a disable comment with the reason.',
  },
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'dangerouslySetInnerHTML is only allowed in the Markdown view component.',
  },
  {
    selector: 'TSEnumDeclaration',
    message: 'Use a string-literal union or an `as const` object instead of an enum.',
  },
];
const noDefaultExport = {
  selector: 'ExportDefaultDeclaration',
  message: 'Use named exports. Default exports are only for files Next.js requires.',
};

export default defineConfig([
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),

  /* ---------------- TypeScript: strictest type-aware rule sets ---------------- */
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /* No any, in any form */
      '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: false, ignoreRestArgs: false }],
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      /* Assertions and escapes */
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],

      /* Exhaustiveness and explicitness */
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowString: false, allowNumber: false, allowNullableObject: true },
      ],

      /* Imports */
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      'no-restricted-imports': restrictImports({ reason: '' }),

      /* Promises */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/return-await': ['error', 'always'],

      /* Syntax and hygiene */
      'no-restricted-syntax': ['error', ...bannedSyntax],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'no-param-reassign': 'error',
      'prefer-const': 'error',
    },
  },

  /* ---------------- React and Next.js ---------------- */
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },

  /* ---------------- Named exports outside Next.js route files ---------------- */
  {
    files: ['src/server/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...bannedSyntax, noDefaultExport] },
  },

  /* ---------------- Layer boundaries (docs/02-architecture.md §3.2) ---------------- */
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: ['server', 'ui', 'app'],
        packages: [...framework, ...dataAccess, 'server-only'],
        reason: 'lib is shared pure code: no server, ui, app, framework or database imports.',
      }),
    },
  },
  {
    files: ['src/server/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: [
          'server/db',
          'server/repositories',
          'server/services',
          'server/github',
          'server/auth',
          'server/reports',
          'server/actions',
          'app',
          'ui',
        ],
        packages: [...framework, ...dataAccess],
        reason: 'domain is pure logic: no I/O, no database, no framework.',
      }),
    },
  },
  {
    files: ['src/server/repositories/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: [
          'server/services',
          'server/github',
          'server/auth',
          'server/reports',
          'server/actions',
          'app',
          'ui',
        ],
        packages: framework,
        reason: 'repositories contain queries only.',
      }),
    },
  },
  {
    files: ['src/server/services/**/*.{ts,tsx}', 'src/server/github/**/*.{ts,tsx}', 'src/server/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: ['server/actions', 'app', 'ui'],
        packages: framework,
        reason: 'services, github and db must not know about HTTP, Next.js or the UI.',
      }),
    },
  },
  {
    files: ['src/server/reports/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: ['server/services', 'server/actions', 'app', 'ui'],
        packages: framework,
        reason: 'reports load, build and render without the framework.',
      }),
    },
  },
  {
    files: ['src/server/auth/**/*.{ts,tsx}'],
    ignores: ['src/server/auth/next-session.ts'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: ['server/actions', 'app', 'ui'],
        packages: framework,
        reason: 'Only auth/next-session.ts may touch Next.js.',
      }),
    },
  },
  {
    // Framework-free HTTP handlers (OAuth lives in auth/): plain Request → Response.
    files: ['src/server/http/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: ['server/actions', 'app', 'ui'],
        packages: framework,
        reason: 'HTTP handlers use web-standard Request/Response, never Next.js.',
      }),
    },
  },
  {
    files: ['src/server/actions/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: ['server/repositories', 'server/db', 'app', 'ui'],
        packages: dataAccess,
        reason: 'Server Actions call services, never repositories or the database directly.',
      }),
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        layers: ['server', 'app'],
        packages: [...dataAccess, 'server-only'],
        reason: 'UI components take view-model props; they never import server code.',
      }),
    },
  },

  /* ---------------- Exceptions ---------------- */
  {
    // The single place allowed to render HTML (markdown-it output, html: false).
    files: ['src/ui/components/markdown-view.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...bannedSyntax.filter((ban) => !ban.selector.startsWith('JSXAttribute')),
        noDefaultExport,
      ],
    },
  },
  {
    // The logger and command-line scripts write to stdout.
    files: ['src/server/log.ts', 'scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  /* ---------------- This file is plain JS: no type-aware linting ---------------- */
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
