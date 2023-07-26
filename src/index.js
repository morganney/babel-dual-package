#!/usr/bin/env node

import { cwd, argv, versions } from 'node:process'
import { performance } from 'node:perf_hooks'
import { resolve, dirname, relative, join, extname, basename } from 'node:path'
import { stat, writeFile, copyFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

import { version } from '@babel/core'
import { glob } from 'glob'

import { init } from './init.js'
import { transform, updateDtsSpecifiers } from './transform.js'
import {
  logError,
  logResult,
  getFiles,
  getOutExt,
  getEsmPlugins,
  getModulePresets,
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
    const copyFiles = args.values['copy-files']
    const { minified, extensions } = args.values

    if (!presets.length) {
      addDefaultPresets(presets, extensions)
    }

    let numFilesCompiled = 0
    let compileTime = 0
    let [tsFilesUpdated, tsUpdateTime, tsStartTime] = [0, 0, 0]
    const dmctsRegex = /\.d\.[mc]?ts$/
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
        ast: false,
        sourceType: 'module',
        // Custom options
        esmPresets,
        esmPlugins,
        cjsPresets,
        outFileExtension,
        keepFileExtension
      })

      if (code) {
        const extRegex = /(\.\w+)$/i
        const relativeFn = positional
          ? relative(positional, filename)
          : basename(filename)
        const esmExt = getOutExt(filename, outFileExtension, keepFileExtension)
        const cjsExt = getOutExt(filename, outFileExtension, keepFileExtension, 'cjs')
        let outEsm = join(outDir, relativeFn)
        let outCjs = join(noCjsDir ? outDir : cjsOutDir, relativeFn)

        outEsm = outEsm.replace(extRegex, esmExt)
        outCjs = outCjs.replace(extRegex, cjsExt)

        await mkdir(dirname(outEsm), { recursive: true })
        await mkdir(dirname(outCjs), { recursive: true })

        await writeFile(outEsm, code.esm)
        await writeFile(outCjs, code.cjs)

        if (sourceMaps && map) {
          await writeFile(`${outEsm}.map`, JSON.stringify(map.esm, null, 2))
          await writeFile(`${outCjs}.map`, JSON.stringify(map.cjs, null, 2))
        }
      }
    }

    for (const pos of args.positionals) {
      const posPath = resolve(relative(cwd(), pos))
      let stats = null

      try {
        stats = await stat(posPath)
      } catch {
        // Move to next loop iteration if provided positional results in bogus path
        continue
      }

      if (stats.isFile()) {
        if (!dmctsRegex.test(posPath) && extensions.includes(extname(posPath))) {
          await build(posPath)
          numFilesCompiled++
        }
      } else {
        const allFiles = await getFiles(posPath)
        const fileHasExpectedExt = (file) => extensions.includes(extname(file))
        const files = allFiles.filter(
          (file) => fileHasExpectedExt(file) && !dmctsRegex.test(file)
        )
        const nonCompilable = !copyFiles
          ? []
          : allFiles.filter((file) => !fileHasExpectedExt(file))

        for (const filename of files) {
          await build(filename, posPath)
          numFilesCompiled++
        }

        // Copy any non-compilable files
        for (const nonComp of nonCompilable) {
          const relativeFn = relative(posPath, nonComp)
          const outEsm = join(outDir, relativeFn)

          await mkdir(dirname(outEsm), { recursive: true })
          await copyFile(nonComp, outEsm)

          if (!noCjsDir) {
            const outCjs = join(cjsOutDir, relativeFn)

            await mkdir(dirname(outCjs), { recursive: true })
            await copyFile(nonComp, outCjs)
          }
        }
      }
    }

    compileTime = performance.now()

    if (existsSync(outDir)) {
      tsStartTime = performance.now()

      const files = (await getFiles(outDir)).filter((file) => dmctsRegex.test(file))

      for (const filename of files) {
        const base = basename(filename)
        let outCjs = join(noCjsDir ? outDir : cjsOutDir, base)

        if (keepFileExtension) {
          await mkdir(dirname(outCjs), { recursive: true })
          await copyFile(filename, outCjs)
        } else {
          const { esm: esmTypes, cjs: cjsTypes } = await updateDtsSpecifiers(
            filename,
            outFileExtension
          )
          const dtsRegex = /(\.d\.ts)$/
          const outEsmOrig = join(outDir, base)
          let outEsm = outEsmOrig

          if (dtsRegex.test(base)) {
            const { esm, cjs } = outFileExtension
            // Reduce extended extensions to last extension
            const esmExt = extname(esm)
            const cjsExt = extname(cjs)
            // Restore extension if not using extended extensions
            const esmOut = esmExt || esm
            const cjsOut = cjsExt || cjs
            // Force .cjs files to use .d.cts declarations
            const repl = cjsOut === '.cjs' ? '.d.cts' : '$1'

            outEsm = outEsm.replace(dtsRegex, `${esm.replace(esmOut, '')}$1`)
            outCjs = outCjs.replace(dtsRegex, `${cjs.replace(cjsOut, '')}${repl}`)
          }

          await mkdir(dirname(outCjs), { recursive: true })
          await writeFile(outEsm, esmTypes)
          await writeFile(outCjs, cjsTypes)

          /**
           * TypeScript does not allow changing out file extensions,
           * so there may be some stranded .d.ts files in --out-dir
           * if --out-file-extension changed the original extensions.
           *
           * @see https://github.com/microsoft/TypeScript/issues/49462
           */
          if (outEsmOrig !== outEsm) {
            await rm(outEsmOrig, { force: true })
          }
        }

        tsFilesUpdated++
      }

      tsUpdateTime = performance.now()
    }

    logResult(
      `Successfully compiled ${numFilesCompiled} file${
        numFilesCompiled === 1 ? '' : 's'
      } as ESM and CJS in ${Math.abs(
        Math.round(compileTime - startTime)
      )}ms with Babel ${version}.`
    )

    if (tsFilesUpdated) {
      logResult(
        `Successfully copied and updated ${tsFilesUpdated} typescript declaration file${
          tsFilesUpdated === 1 ? '' : 's'
        } in ${Math.abs(Math.round(tsUpdateTime - tsStartTime))}ms.`
      )
    }
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
