#!/usr/bin/env node

import { cwd } from 'node:process'
import { performance } from 'node:perf_hooks'
import { resolve, dirname, relative, join, extname, basename } from 'node:path'
import { lstat, readdir, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

import { version } from '@babel/core'

import { init } from './init.js'
import { transform, transformDtsExtensions } from './transform.js'
import {
  logError,
  logResult,
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

  const esmPresets = getModulePresets(presets, 'esm')
  const cjsPresets = getModulePresets(presets, 'cjs')
  const esmPlugins = getEsmPlugins(plugins)
  const startTime = performance.now()
  let numFilesCompiled = 0

  async function build(filename, positional) {
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
      cjsPresets,
      outFileExtension,
      keepFileExtension
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
      const dirents = await readdir(posPath, { recursive: true, withFileTypes: true })
      const files = dirents.filter(
        (dirent) => dirent.isFile() && extensions.includes(extname(dirent.name))
      )

      for (const { path, name } of files) {
        await build(join(path, name), posPath)
      }
    }
  }

  if (!noCjsDir && !keepFileExtension && !outFileExtension && existsSync(cjsOutDir)) {
    const dtsDirents = await readdir(cjsOutDir, { recursive: true, withFileTypes: true })
    const dtsFiles = dtsDirents.filter(
      (dirent) => dirent.isFile() && dirent.name.endsWith('.d.ts')
    )

    for (const dtsFile of dtsFiles) {
      const dtsFilename = join(dtsFile.path, dtsFile.name)
      const dtsFileCjsExtensions = await transformDtsExtensions(dtsFilename)

      await rm(dtsFilename, { force: true })
      await writeFile(dtsFilename.replace(/(\.d\.ts)$/, '.d.cts'), dtsFileCjsExtensions)
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
