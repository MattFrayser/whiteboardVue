import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
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
                // Node globals (for config files)
                process: 'readonly',
                __dirname: 'readonly',
                module: 'readonly',
            },
        },
        plugins: {
            import: importPlugin,
        },
        rules: {
            // Error prevention
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'warn',
            'no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],

            // Code quality
            'prefer-const': 'error',
            'no-var': 'error',
            'object-shorthand': 'warn',
            'prefer-template': 'warn',

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
        ignores: ['node_modules/', 'dist/', '*.config.js', '*.config.cjs', 'coverage/'],
    },
]
