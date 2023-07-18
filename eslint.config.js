import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  /**
   * Can't extend jest's configuration due to the
   * incompatibility between the classic config,
   * and the new flat config.
   * @see https://github.com/eslint/eslint/issues/17355
   */
  // jest.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    files: ['**/*.js'],
    rules: {
      'no-console': 'error'
    }
  }
]
