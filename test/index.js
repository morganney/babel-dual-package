import { describe, it } from 'node:test'
import assert from 'node:assert'
import { types } from 'node:util'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('babel-dual-package', () => {
  it('exports a function when imported as a module', async () => {
    const { babelDualPackage } = await import('../src/index.js')

    assert.ok(types.isAsyncFunction(babelDualPackage))
  })

  it('accepts args from import query params to run', async (t) => {
    const spy = t.mock.method(global.console, 'log')

    await import(
      `../src/index.js?args=${encodeURIComponent(
        JSON.stringify({
          '--out-dir': 'dist',
          '--no-cjs-dir': '',
          files: ['src/index.js']
        })
      )}`
    )
    // Wait, I don't want to be hung up in CI
    await new Promise((resolve) => setTimeout(resolve, 150))

    assert.ok(
      spy.mock.calls[0].arguments[1].startsWith(
        'Successfully compiled 1 file as ESM and CJS'
      )
    )
    assert.ok(existsSync(resolve(__dirname, '../dist/index.js')))
  })
})
