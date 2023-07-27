import { describe, it, before, afterEach } from 'node:test'
import assert from 'node:assert'
import { types } from 'node:util'
import { existsSync } from 'node:fs'
import { rm, mkdir, cp, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/* eslint-disable no-undef */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = resolve(__dirname, '..')
const dist = resolve(__dirname, '../dist')
const fixtures = resolve(__dirname, '__fixtures__')
const wait = async (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('babel-dual-package', () => {
  before(async () => {
    await rm(dist, { recursive: true, force: true })
  })
  /**
   * Having more than 10 unit tests here causes memory leak warning:
   * `MaxListenersExceededWarning: Possible EventTarget memory leak detected. 11 abort listeners added to [AbortSignal].`
   *
   * @see https://github.com/nodejs/node/issues/48475
   */
  afterEach(async () => {
    await rm(dist, { recursive: true, force: true })
  })

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
          '--source-maps': '',
          files: ['test/__fixtures__/file.js']
        })
      )}`
    )
    await wait(150)

    assert.ok(
      spy.mock.calls[0].arguments[1].startsWith(
        'Successfully compiled 1 file as ESM and CJS'
      )
    )
    assert.ok(existsSync(resolve(dist, 'file.js')))
    assert.ok(existsSync(resolve(dist, 'file.js.map')))
    assert.ok(!existsSync(resolve(dist, 'cjs')))
  })

  it('loads default presets when none found', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')
    const from = 'babel.config.json'
    const to = 'babel.config.bak.json'

    await rename(resolve(root, from), resolve(root, to))
    await babelDualPackage(['test/__fixtures__/file.js'])
    await wait(150)
    assert.ok(
      spy.mock.calls[1].arguments[1].startsWith(
        'Successfully compiled 1 file as ESM and CJS'
      )
    )
    await rename(resolve(root, to), resolve(root, from))
  })

  it('builds files from directories', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage(['test/__fixtures__/mixed', '--keep-file-extension'])
    await wait(150)

    assert.ok(
      spy.mock.calls[0].arguments[1].startsWith(
        'Successfully compiled 3 files as ESM and CJS'
      )
    )
    assert.ok(existsSync(resolve(dist, 'file.js')))
    assert.ok(existsSync(resolve(dist, 'file.cjs')))
    assert.ok(existsSync(resolve(dist, 'file.mjs')))
    assert.ok(existsSync(resolve(dist, 'cjs/file.js')))
    assert.ok(existsSync(resolve(dist, 'cjs/file.cjs')))
    assert.ok(existsSync(resolve(dist, 'cjs/file.mjs')))
  })

  it('ignores bogus file paths', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage(['src/missing.js'])
    await wait(150)

    assert.ok(
      spy.mock.calls[0].arguments[1].startsWith(
        'Successfully compiled 0 files as ESM and CJS'
      )
    )
  })

  it('warns no files were passed to build', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage()
    await wait(150)
    assert.ok(spy.mock.calls[0].arguments[1].startsWith('No filenames found'))

    await import(
      `../src/index.js?args=${encodeURIComponent(
        JSON.stringify({
          '--out-dir': 'dist'
        })
      )}`
    )
    await wait(150)
    assert.ok(spy.mock.calls[0].arguments[1].startsWith('No filenames found'))
  })

  it('warns when --out-file-extension is wrong format', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage(['test/__fixtures__/file.js', '--out-file-extension', 'bogus'])
    await wait(150)
    assert.ok(spy.mock.calls[0].arguments[1].startsWith('Invalid argument'))
  })

  it('warns when --extensions passes an invalid one', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage(['test/__fixtures__/file.js', '--extensions', '.js,.json'])
    await wait(150)
    assert.ok(spy.mock.calls[0].arguments[1].startsWith('Invalid argument'))
  })

  it('warns when --root-mode passes an invalid one', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage(['test/__fixtures__/file.js', '--root-mode', 'invalid'])
    await wait(150)
    assert.ok(spy.mock.calls[0].arguments[1].startsWith('Invalid argument'))
  })

  it('warns when --keep-file-extension and --out-file-extension are both used', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage([
      'test/__fixtures__/file.js',
      '--keep-file-extension',
      '--out-file-extension',
      'esm:.js,cjs:.cjs'
    ])
    await wait(150)
    assert.ok(spy.mock.calls[0].arguments[1].endsWith('are mutually exclusive.'))
  })

  it('warns when invalid args passed in import query', async (t) => {
    const spy = t.mock.method(global.console, 'log')

    await import(`../src/index.js?args=${encodeURIComponent(JSON.stringify(() => {}))}`)
    await wait(150)
    assert.ok(
      spy.mock.calls[0].arguments[1].startsWith('Invalid args passed in import query')
    )
  })

  it('shows options when passing arg --help', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage(['test/__fixtures__/file.js', '--help'])
    await wait(150)
    assert.ok(
      spy.mock.calls[spy.mock.calls.length - 1].arguments[1].endsWith(
        'Output usage information (this information).'
      )
    )
  })

  it('supports typescript and updates declaration files', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await mkdir(dist, { recursive: true })
    await cp(resolve(fixtures, 'types'), resolve(dist), { recursive: true })
    await babelDualPackage(['test/__fixtures__/ts', '--extensions', '.ts,.mts,.cts'])
    await wait(150)

    assert.ok(spy.mock.calls[0].arguments[1].startsWith('Successfully compiled 4 files'))
    assert.ok(
      spy.mock.calls[1].arguments[1].startsWith(
        'Successfully copied and updated 4 TypeScript declaration files'
      )
    )
    assert.ok(existsSync(resolve(dist, 'cjs/file.d.cts')))
    assert.ok(!existsSync(resolve(dist, '.babelrc.json')))
  })

  it('allows declaration files to have .d.ts extension in cjs dir', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await mkdir(dist, { recursive: true })
    await cp(resolve(fixtures, 'types'), resolve(dist), { recursive: true })
    await babelDualPackage([
      'test/__fixtures__/ts',
      '--extensions',
      '.ts,.mts,.cts',
      '--out-file-extension',
      'esm:.esm.js,cjs:.cjs.js'
    ])
    await wait(150)

    assert.ok(spy.mock.calls[0].arguments[1].startsWith('Successfully compiled 4 files'))
    assert.ok(
      spy.mock.calls[1].arguments[1].startsWith(
        'Successfully copied and updated 4 TypeScript declaration files'
      )
    )
    assert.ok(existsSync(resolve(dist, 'cjs/file.cjs.d.ts')))
    assert.ok(existsSync(resolve(dist, 'cjs/other.ext.cjs.d.ts')))
    assert.ok(existsSync(resolve(dist, 'cjs/module.es.d.mts')))
    // Check that any unnecessary .d.ts files are removed if using extended extensions
    assert.ok(!existsSync(resolve(dist, 'file.d.ts')))
  })

  it('copies declaration files as-is when using --keep-file-extension', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await mkdir(dist, { recursive: true })
    await cp(resolve(fixtures, 'types', 'file.d.ts'), resolve(dist, 'file.d.ts'), {
      recursive: true
    })
    await babelDualPackage([
      'test/__fixtures__/ts/file.d.ts',
      '--extensions',
      '.ts',
      '--keep-file-extension'
    ])
    await wait(150)

    assert.ok(
      spy.mock.calls[1].arguments[1].startsWith(
        'Successfully copied and updated 1 TypeScript declaration file'
      )
    )
    assert.ok(existsSync(resolve(dist, 'cjs/file.d.ts')))
  })

  it('copies all non-compilable and non-ignored files when using --copy-files', async (t) => {
    const { babelDualPackage } = await import('../src/index.js')
    const spy = t.mock.method(global.console, 'log')

    await babelDualPackage(['test/__fixtures__/copy', '--copy-files'])
    await wait(150)

    assert.ok(spy.mock.calls[0].arguments[1].startsWith('Successfully compiled 1 file'))
    assert.ok(existsSync(resolve(dist, 'file.html')))
    assert.ok(existsSync(resolve(dist, 'dir', 'file.json')))
    assert.ok(!existsSync(resolve(dist, 'dir', 'test.js')))
    assert.ok(!existsSync(resolve(dist, 'cjs', 'dir', 'test.js')))
    assert.ok(!existsSync(resolve(dist, '.babelrc.json')))
    assert.ok(!existsSync(resolve(dist, 'ignored.mjs')))
  })
})
