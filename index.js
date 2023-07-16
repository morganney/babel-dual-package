#!/usr/bin/env node

import { cwd } from 'node:process'
import { performance } from 'node:perf_hooks'
import { resolve, dirname, relative, join, extname, basename } from 'node:path'
import { lstat, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

import { version } from '@babel/core'

import { init } from './init.js'
import { transform, transformDtsExtensions } from './transform.js'
import {
  logError,
  logResult,
  getFiles,
  getEsmPlugins,
  getModulePresets,
  getOutFileExt,
  addDefaultPresets
} from './util.js'

const ctx = await init(logError)

if (ctx) {
  const { args, babelConfig } = ctx
  const { targets, plugins, presets } = babelConfig.options
  const outDir = resolve(relative(cwd(), args.values['out-dir']))
  const cjsOutDir = join(outDir, args.values['cjs-dir-name'])
  const keepFileExtension = args.values['keep-file-extension']
  const outFileExtension = args.values['out-file-extension']
  const noCjsDir = args.values['no-cjs-dir']
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
    const { code } = await transform(filename, {
      targets,
      presets,
      plugins,
      filename,
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
      const relativeFn = positional ? relative(positional, filename) : basename(filename)
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

      numFilesCompiled++
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
      }
    }
  }

  if (!noCjsDir && !keepFileExtension && !outFileExtension && existsSync(cjsOutDir)) {
    const files = (await getFiles(cjsOutDir)).filter((file) => file.endsWith('.d.ts'))

    for (const filename of files) {
      const fileCjs = await transformDtsExtensions(filename)

      await rm(filename, { force: true })
      await writeFile(filename.replace(/(\.d\.ts)$/, '.d.cts'), fileCjs)
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
