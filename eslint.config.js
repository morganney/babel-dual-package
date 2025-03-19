import js from '@eslint/js'
import globals from 'globals'
import n from 'eslint-plugin-n'

export default [
  js.configs.recommended,
  n.configs['flat/recommended'],
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
    files: ['*.js', 'src/*.js', 'test/*.js'],
    ignores: ['**/build.js'],
    rules: {
      'no-console': 'error',
      'no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true
        }
      ],
      'n/hashbang': [
        'error',
        {
          convertPath: {
            'src/*.js': ['^src/(.+)$', 'dist/$1']
          }
        }
      ],
      'n/no-unsupported-features/node-builtins': [
        'error',
        {
          // Ignoring for now in lieu of upgrading the engines field in package.json
          ignores: [
            'util.parseArgs',
            'fs/promises.cp',
            'test',
            'test.it',
            'test.before',
            'test.describe',
            'test.afterEach'
          ]
        }
      ]
    }
  }
]
