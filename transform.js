import { readFile } from 'node:fs/promises'

import { parse } from '@babel/parser'
import { transformAsync } from '@babel/core'
import babelTraverse from '@babel/traverse'
import MagicString from 'magic-string'

import { isEsModuleFile } from './util.js'
import { updateExtensionsToCjs } from './helpers.js'

const traverse = babelTraverse.default
const transform = async (filename, opts) => {
  const source = await readFile(filename)
  const esmSource = source.toString()
  const cjsSource = new MagicString(esmSource)
  const { esmPresets, esmPlugins, cjsPresets, ...rest } = opts
  const baseOpts = {
    ...rest,
    babelrc: false,
    configFile: false
  }
  const {
    ast,
    code: esm,
    map: esmMap
  } = await transformAsync(esmSource, {
    ...baseOpts,
    plugins: esmPlugins,
    presets: esmPresets
  })

  traverse(ast, {
    ImportDeclaration(path) {
      updateExtensionsToCjs(cjsSource, path)
    },
    CallExpression(path) {
      if (path.get('callee').isImport()) {
        updateExtensionsToCjs(cjsSource, path, 'arguments.0')
      }
    },
    'ExportNamedDeclaration|ExportAllDeclaration'(path) {
      updateExtensionsToCjs(cjsSource, path)
    }
  })

  const { code: cjs, map: cjsMap } = await transformAsync(cjsSource.toString(), {
    ...baseOpts,
    ast: false,
    presets: isEsModuleFile(filename) ? esmPresets : cjsPresets
  })

  return {
    code: { esm, cjs },
    map: { esm: esmMap, cjs: cjsMap }
  }
}

const transformDtsExtensions = async (filename) => {
  const source = (await readFile(filename)).toString()
  const dtsCjsSrc = new MagicString(source)
  const ast = parse(source, {
    sourceType: 'module',
    plugins: [['typescript', { dts: true }]]
  })

  traverse(ast, {
    TSImportType(path) {
      updateExtensionsToCjs(dtsCjsSrc, path, 'argument')
    },
    ImportDeclaration(path) {
      updateExtensionsToCjs(dtsCjsSrc, path)
    },
    'ExportNamedDeclaration|ExportAllDeclaration'(path) {
      updateExtensionsToCjs(dtsCjsSrc, path)
    }
  })

  return dtsCjsSrc.toString()
}

export { transform, transformDtsExtensions }
