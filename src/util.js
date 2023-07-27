import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, extname } from 'node:path'
import { readdir, realpath } from 'node:fs/promises'

import { createConfigItem, loadPartialConfigAsync } from '@babel/core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const red = '\x1b[31m'
const cyan = '\x1b[36m'
const black = '\x1b[30m'
const jsExtRegex = /\.(js['"`\s]*?)$/i
const relativeSpecifierRegex = /^['"`\s]*?(?:\.|\.\.)\//i
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
const getRealPathAsFileUrl = async (path) => {
  const realPath = await realpath(path)
  const asFileUrl = pathToFileURL(realPath).href

  return asFileUrl
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
const replaceJsExtWithOutExt = (str, ext) => {
  const idx = str.lastIndexOf('.js')

  if (idx > -1) {
    const step = '.js'.length

    return `${str.substring(0, idx)}${ext}${str.substring(idx + step, str.length)}`
  }
}
const isRelative = (str) => {
  // Obvious relative, or starts with a template string and has .js ext.
  return relativeSpecifierRegex.test(str) || (/^`\${/i.test(str) && hasJsExt(str))
}
const isEsModuleFile = (filename) => /\.m[jt]s$/.test(filename)
const isCjsFile = (filename) => /\.c[jt]s$/.test(filename)
const getOutExt = (filename, outFileExtension, keepFileExtension, type = 'esm') => {
  if (keepFileExtension) {
    return extname(filename)
  }

  if (isEsModuleFile(filename) || isCjsFile(filename)) {
    return extname(filename).replace(/(ts)$/, 'js')
  }

  return outFileExtension[type]
}
const getBabelFileHandling = async (filename) => {
  const conf = await loadPartialConfigAsync({ filename, showIgnoredFiles: true })

  return conf.fileHandling
}

export {
  logHelp,
  logError,
  logResult,
  hasJsExt,
  isEsModuleFile,
  isRelative,
  replaceJsExtWithOutExt,
  getFiles,
  getEsmPlugins,
  getOutExt,
  getRealPathAsFileUrl,
  getModulePresets,
  getBabelFileHandling,
  addDefaultPresets
}
