import { inspect } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readdir } from 'node:fs/promises'

import { createConfigItem } from '@babel/core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const red = '\x1b[31m'
const cyan = '\x1b[36m'
const black = '\x1b[30m'
const jsExtRegex = /\.(js['"`\s]*?)$/i
const relativeSpecifierRegex = /^['"`\s]*?(?:\.|\.\.)\//i
const dump = (obj = {}, prefix = '') => {
  // eslint-disable-next-line no-console
  console.log(prefix, inspect(obj, false, null, true))
}
const log = (color = cyan, msg = '', prefix = '') => {
  // eslint-disable-next-line no-console
  console.log(`${color}%s\x1b[0m`, `${prefix}${msg}`)
}
const logError = log.bind(null, red)
const logNotice = log.bind(null, cyan)
const logResult = log.bind(null, black)
const logHelp = (msg) => {
  logResult(msg, '')
}
const getFiles = async (dir) => {
  const dirents = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const path = resolve(dir, dirent.name)

      return dirent.isFile() ? path : getFiles(path)
    })
  )

  return files.flat()
}
const getConfigItem = (value, type = 'preset') => {
  return createConfigItem(value, { type, dirname: __dirname })
}
const getPresetIdx = (presets, preset) => {
  return presets.findIndex((pre) => {
    return new RegExp(`@babel/preset-${preset}`).test(pre.file?.resolved)
  })
}
const getPluginIdx = (plugins, plugin) => {
  return plugins.findIndex((plug) => {
    return new RegExp(`@babel/plugin-${plugin}`).test(plug.file?.resolved)
  })
}
const getListWithItemRemoved = (list, item, type) => {
  const gettersIdx = {
    preset: () => getPresetIdx(list, item),
    plugin: () => getPluginIdx(list, item)
  }
  const idx = gettersIdx[type]()

  if (idx > -1) {
    const clone = [...list]

    clone.splice(idx, 1)

    return clone
  }

  return list
}
const addDefaultPresets = (presets, extensions) => {
  const shouldDisallow = /\.(?:mts|cts|tsx)/i.test(extensions.join(''))
  const isTsx = extensions.includes('.tsx')
  const allExtensions = isTsx || shouldDisallow ? true : false

  logNotice(
    'No presets found, using default presets: ["@babel/preset-env", "@babel/preset-typescript", "@babel/preset-react"]'
  )
  presets.push(
    getConfigItem('@babel/preset-env'),
    getConfigItem([
      '@babel/preset-typescript',
      {
        allExtensions,
        allowDeclareFields: true,
        isTSX: isTsx,
        disallowAmbiguousJSXLike: shouldDisallow
      }
    ]),
    getConfigItem(['@babel/preset-react', { runtime: 'automatic' }])
  )
}
const getModulePresets = (presets, type = 'esm') => {
  const clones = [...presets]
  const modules = type === 'esm' ? false : 'commonjs'
  const envPresetIdx = clones.findIndex((preset) =>
    /@babel\/preset-env/.test(preset.file.resolved)
  )

  if (envPresetIdx > -1) {
    clones.splice(
      envPresetIdx,
      1,
      getConfigItem([
        '@babel/preset-env',
        {
          ...clones[envPresetIdx].options,
          modules
        }
      ])
    )
  } else {
    clones.unshift(getConfigItem(['@babel/preset-env', { modules }]))
  }

  return clones
}
const getEsmPlugins = (plugins) => {
  const clones = [...plugins]
  const cjsPluginIdx = clones.findIndex((plugin) =>
    /@babel\/plugin-transform-modules-commonjs/.test(plugin.file.resolved)
  )

  if (cjsPluginIdx > -1) {
    // Remove this plugin and use preset-env `modules` option instead
    clones.splice(cjsPluginIdx, 1)
  }

  return clones
}
const hasJsExt = (str) => jsExtRegex.test(str)
const replaceJsExtWithCjs = (str) => {
  const idx = str.lastIndexOf('.js')
  const step = '.js'.length

  if (idx > -1) {
    const newExt = '.cjs'

    return `${str.substring(0, idx)}${newExt}${str.substring(idx + step, str.length)}`
  }

  return str
}
const isRelative = (str) => {
  // Obvious relative, or starts with a template string and has .js ext.
  return relativeSpecifierRegex.test(str) || (/^`\${/i.test(str) && hasJsExt(str))
}
const isEsModuleFile = (str) => /\.m[jt]s?/.test(str)
const getOutFileExt = (ext, outFileExtension, keepFileExtension, type = 'esm') => {
  if (outFileExtension) {
    return outFileExtension
  }

  if (keepFileExtension) {
    return ext
  }

  if (/\.m[jt]s/.test(ext)) {
    return '.mjs'
  }

  if (/\.c[jt]s/.test(ext) || type === 'cjs') {
    return '.cjs'
  }

  return '.js'
}

export {
  dump,
  log,
  logHelp,
  logError,
  logNotice,
  logResult,
  hasJsExt,
  isEsModuleFile,
  isRelative,
  replaceJsExtWithCjs,
  getFiles,
  getEsmPlugins,
  getPresetIdx,
  getPluginIdx,
  getConfigItem,
  getOutFileExt,
  getListWithItemRemoved,
  getModulePresets,
  addDefaultPresets
}
