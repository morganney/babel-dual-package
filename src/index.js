#!/usr/bin/env node

import { cwd, argv, versions } from 'node:process'
import { performance } from 'node:perf_hooks'
import { resolve, dirname, relative, join, extname, basename } from 'node:path'
import { lstat, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

import { version } from '@babel/core'
import { glob } from 'glob'

import { init } from './init.js'
import { transform, transformDtsExtensions } from './transform.js'
import {
  logError,
  logResult,
  getFiles,
  getEsmPlugins,
  getModulePresets,
  getOutFileExt,
  getRealPathAsFileUrl,
  addDefaultPresets
} from './util.js'

const babelDualPackage = async (moduleArgs) => {
  const ctx = await init(moduleArgs, logError)

  if (ctx) {
    const { args, babelConfig } = ctx
    const { targets, plugins, presets } = babelConfig.options
    const outDir = resolve(relative(cwd(), args.values['out-dir']))
    const cjsOutDir = join(outDir, args.values['cjs-dir-name'])
    const keepFileExtension = args.values['keep-file-extension']
    const outFileExtension = args.values['out-file-extension']
    const noCjsDir = args.values['no-cjs-dir']
    const sourceMaps = args.values['source-maps']
    const minified = args.values.minified
    const extensions = args.values.extensions
      .split(',', 8)
      .map((ext) => ext.trim())
      .filter(Boolean)

    if (!presets.length) {
      addDefaultPresets(presets, extensions)
    }

    let numFilesCompiled = 0
    const esmPresets = getModulePresets(presets, 'esm')
    const cjsPresets = getModulePresets(presets, 'cjs')
    const esmPlugins = getEsmPlugins(plugins)
    const startTime = performance.now()
    const build = async (filename, positional) => {
      const { code, map } = await transform(filename, {
        targets,
        presets,
        plugins,
        filename,
        minified,
        sourceMaps,
        ast: true,
        sourceType: 'module',
        // Custom options
        esmPresets,
        esmPlugins,
        cjsPresets
      })

      if (code) {
        const extRegex = /(\.\w+)$/i
        const ext = extname(filename)
        const relativeFn = positional
          ? relative(positional, filename)
          : basename(filename)
        const outFile = join(outDir, relativeFn)
        const outFileCjs = join(noCjsDir ? outDir : cjsOutDir, relativeFn)

        await mkdir(dirname(outFile), { recursive: true })
        await mkdir(dirname(outFileCjs), { recursive: true })
        await writeFile(
          outFile.replace(
            extRegex,
            getOutFileExt(ext, outFileExtension, keepFileExtension)
          ),
          code.esm
        )
        await writeFile(
          outFileCjs.replace(
            extRegex,
            getOutFileExt(ext, outFileExtension, keepFileExtension, 'cjs')
          ),
          code.cjs
        )

        if (sourceMaps && map) {
          await writeFile(
            outFile.replace(
              extRegex,
              `${getOutFileExt(ext, outFileExtension, keepFileExtension)}.map`
            ),
            JSON.stringify(map.esm, null, 2)
          )
          await writeFile(
            outFileCjs.replace(
              extRegex,
              `${getOutFileExt(ext, outFileExtension, keepFileExtension, 'cjs')}.map`
            ),
            JSON.stringify(map.cjs, null, 2)
          )
        }
      }
    }

    for (const pos of args.positionals) {
      const posPath = resolve(relative(cwd(), pos))
      let stats = null

      try {
        stats = await lstat(posPath)
      } catch {
        // Move to next loop iteration if provided positional results in bogus path
        continue
      }

      if (stats.isFile()) {
        if (extensions.includes(extname(posPath))) {
          await build(posPath)
          numFilesCompiled++
        }
      } else {
        const files = (await getFiles(posPath)).filter((file) =>
          extensions.includes(extname(file))
        )

        for (const filename of files) {
          await build(filename, posPath)
          numFilesCompiled++
        }
      }
    }

    if (outFileExtension.cjs.endsWith('.cjs') && existsSync(outDir)) {
      /**
       * Updates import/export extensions and renames .d.ts ext to .d.cts
       * while writing to the CJS output path.
       */
      const files = (await getFiles(outDir)).filter((file) => file.endsWith('.d.ts'))

      for (const filename of files) {
        const fileCjs = await transformDtsExtensions(filename)
        const filenameCjs = join(noCjsDir ? outDir : cjsOutDir, basename(filename))

        await writeFile(filenameCjs.replace(/(\.d\.ts)$/, '.d.cts'), fileCjs)
        numFilesCompiled++
      }
    }

    logResult(
      `Successfully compiled ${numFilesCompiled} file${
        numFilesCompiled === 1 ? '' : 's'
      } as ESM and CJS in ${Math.round(
        performance.now() - startTime
      )}ms with Babel ${version}.`
    )
  }
}
const url = new URL(import.meta.url)
const args = url.searchParams.get('args')
const realFileUrlArgv1 = await getRealPathAsFileUrl(argv[1])

if (parseFloat(versions.node) < 16.19) {
  logError('This script requires a Node version >= 16.19.0')
} else if (import.meta.url === realFileUrlArgv1) {
  await babelDualPackage()
} else if (args) {
  let moduleArgs = null

  try {
    moduleArgs = JSON.parse(args)
  } catch (err) {
    logError('Invalid args passed in import query. Not parsable as JSON.')
    logResult(`Error: ${err.message}`)
  }

  if (moduleArgs) {
    if (moduleArgs.files && Array.isArray(moduleArgs.files)) {
      let positionals = []

      // Expand any globs and use as positionals, like in a shell
      for (const file of moduleArgs.files) {
        positionals = positionals.concat(await glob(file, { ignore: 'node_modules/**' }))
      }

      delete moduleArgs.files
      positionals = Object.entries(moduleArgs).concat(positionals)
      moduleArgs = positionals.flat().filter(Boolean)

      await babelDualPackage(moduleArgs)
    } else {
      logError(
        'No filenames found. Did you forget to pass a "files" key as an array of strings?'
      )
    }
  }
}

export { babelDualPackage }
