import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 'mnt' ist ein git-ignoriertes Harness-Mount mit einer verschachtelten
  // Projekt-Kopie — nie linten (sonst doppelte tsconfig-Roots).
  globalIgnores(['dist', 'mnt']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        // Eindeutiger Projekt-Root fuer typaware Parsing (react-hooks 7.1).
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
