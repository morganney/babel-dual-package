import { readFile } from 'node:fs/promises'

import { parse } from '@babel/parser'
import { transformAsync } from '@babel/core'
import babelTraverse from '@babel/traverse'
import MagicString from 'magic-string'

import { isEsModuleFile } from './util.js'
import { updateSpecifierExtensions } from './helpers.js'

const traverse = babelTraverse.default
const transform = async (filename, opts) => {
  const source = (await readFile(filename)).toString()
  const esm = new MagicString(source)
  const cjs = new MagicString(source)
  const {
    esmPresets,
    esmPlugins,
    cjsPresets,
    outFileExtension,
    keepFileExtension,
    ...rest
  } = opts
  const baseOpts = { ...rest, configFile: false }
  const specifierOpts = { esm, cjs, outFileExtension, source }
  const ast = parse(source, {
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
    plugins: ['typescript', 'jsx']
  })

  if (!keepFileExtension) {
    traverse(ast, {
      ImportDeclaration(path) {
        updateSpecifierExtensions({ ...specifierOpts, path })
      },
      CallExpression(path) {
        if (path.get('callee').isImport()) {
          updateSpecifierExtensions({ ...specifierOpts, path, key: 'arguments.0' })
        }
      },
      'ExportNamedDeclaration|ExportAllDeclaration'(path) {
        updateSpecifierExtensions({ ...specifierOpts, path })
      }
    })
  }

  const { code: esmCode, map: esmMap } = await transformAsync(esm.toString(), {
    ...baseOpts,
    plugins: esmPlugins,
    presets: esmPresets
  })
  const { code: cjsCode, map: cjsMap } = await transformAsync(cjs.toString(), {
    ...baseOpts,
    presets: isEsModuleFile(filename) ? esmPresets : cjsPresets
  })

  return {
    code: { esm: esmCode, cjs: cjsCode },
    map: { esm: esmMap, cjs: cjsMap }
  }
}

const updateDtsSpecifiers = async (filename, outFileExtension) => {
  const source = (await readFile(filename)).toString()
  const esm = new MagicString(source)
  const cjs = new MagicString(source)
  const ast = parse(source, {
    sourceType: 'module',
    plugins: [['typescript', { dts: true }]]
  })
  const opts = { esm, cjs, outFileExtension }

  traverse(ast, {
    TSImportType(path) {
      updateSpecifierExtensions({ ...opts, path, key: 'argument' })
    },
    ImportDeclaration(path) {
      updateSpecifierExtensions({ ...opts, path })
    },
    'ExportNamedDeclaration|ExportAllDeclaration'(path) {
      updateSpecifierExtensions({ ...opts, path })
    }
  })

  return { esm: esm.toString(), cjs: cjs.toString() }
}

export { transform, updateDtsSpecifiers }
