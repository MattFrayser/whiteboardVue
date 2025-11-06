import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
    js.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json',
            },
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                WebSocket: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            import: importPlugin,
        },
        rules: {
            // Disable JS rules in favor of TS equivalents
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],

            // Error prevention
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'warn',

            // Code quality
            'prefer-const': 'error',
            'no-var': 'error',
            'object-shorthand': 'warn',
            'prefer-template': 'warn',

            // TypeScript-specific
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',

            // Import organization
            'import/order': [
                'warn',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    'newlines-between': 'never',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],

            // Best practices
            eqeqeq: ['error', 'always'],
            curly: ['error', 'all'],
            'no-throw-literal': 'error',
            'prefer-arrow-callback': 'warn',
        },
    },
    {
        ignores: ['node_modules/', 'dist/', '*.config.*', 'coverage/'],
    },
]
