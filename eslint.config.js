import js from '@eslint/js'
import globals from 'globals'
import n from 'eslint-plugin-n'

export default [
  js.configs.recommended,
  /**
   * Can't extend the eslint-plugin-n configuration due to the
   * incompatibility between the classic config, and the new
   * flat config (unless I'm doing something wrong).
   * Changing it here, for now.
   *
   * @see https://github.com/eslint/eslint/issues/17355
   */
  { rules: n.configs['recommended-module'].rules, plugins: { n } },
  {
    languageOptions: {
      /**
       * Need to put important `languageOptions` inside
       * `parserOptions`, as the latter overrides the former
       * whenever it is used.
       *
       * @see https://github.com/eslint/eslint/issues/16559#issuecomment-1642329240
       */
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module'
      },
      globals: {
        ...globals.node
      }
    },
    files: ['*.js', 'src/*.js'],
    ignores: ['**/build.js'],
    rules: {
      'no-console': 'error',
      'no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true
        }
      ],
      'n/shebang': [
        'error',
        {
          convertPath: {
            'src/*.js': ['^src/(.+)$', 'dist/$1']
          }
        }
      ]
    }
  }
]
