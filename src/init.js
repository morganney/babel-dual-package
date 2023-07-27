import { parseArgs } from 'node:util'

import { readPackageUp } from 'read-pkg-up'
import { loadPartialConfigAsync } from '@babel/core'

import { logHelp } from './util.js'

const parseOutFileExtension = (arg, args) => {
  // Allows arguments like `esm:.esm.ext,cjs:.cjs.ext`, in either order.
  const matches = arg.match(
    /^esm:((?:\.\w+)+),cjs:((?:\.\w+)+)|cjs:((?:\.\w+)+),esm:((?:\.\w+)+)$/
  )

  if (!matches) {
    throw new Error(`Invalid argument '${arg}' for --out-file-extension.`)
  }

  args.values['out-file-extension'] = {
    esm: matches[1] ?? matches[4],
    cjs: matches[2] ?? matches[3]
  }
}
const parseExtensions = (exts, args) => {
  const valid = ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.mts', '.cts', '.tsx']
  const extensions = exts
    .split(',', valid.length)
    .map((ext) => ext.trim())
    .filter(Boolean)

  if (extensions.some((ext) => !valid.includes(ext))) {
    throw new Error(
      `Invalid argument ${exts} for --extensions. Only these extensions are valid: ${valid.toString()}.`
    )
  }

  args.values.extensions = extensions
}
const init = async (moduleArgs, onError = () => {}) => {
  const rootModes = ['root', 'upward', 'upward-optional']
  let pkgJson = null
  let args = null
  let babelProjectConfig = null

  try {
    const { values, positionals } = parseArgs({
      args: moduleArgs,
      allowPositionals: true,
      options: {
        help: {
          type: 'boolean',
          default: false
        },
        'out-dir': {
          type: 'string',
          default: 'dist'
        },
        'root-mode': {
          type: 'string',
          default: 'root'
        },
        extensions: {
          type: 'string',
          default: '.js,.jsx,.mjs,.cjs'
        },
        'out-file-extension': {
          type: 'string',
          // Keep this falsy to determine if arg was passed
          default: ''
        },
        'cjs-dir-name': {
          type: 'string',
          default: 'cjs'
        },
        'no-cjs-dir': {
          type: 'boolean',
          default: false
        },
        'keep-file-extension': {
          type: 'boolean',
          default: false
        },
        'source-maps': {
          type: 'boolean',
          default: false
        },
        minified: {
          type: 'boolean',
          default: false
        },
        'copy-files': {
          type: 'boolean',
          default: false
        }
      }
    })

    args = { values, positionals }

    if (!values.help) {
      if (!positionals.length) {
        throw new Error('No filenames found. Did you forget to pass <files ...>?')
      }

      if (!rootModes.includes(values['root-mode'])) {
        throw new Error(
          `Invalid argument for --root-mode. Can be one of ${rootModes.toString()}.`
        )
      }

      if (values['keep-file-extension'] && values['out-file-extension']) {
        throw new Error(
          '--keep-file-extension and --out-file-extension are mutually exclusive.'
        )
      }

      parseExtensions(values['extensions'], args)
      parseOutFileExtension(values['out-file-extension'] || 'esm:.js,cjs:.cjs', args)
      pkgJson = await readPackageUp()

      if (!pkgJson) {
        throw new Error('No package.json file found.')
      }

      if (pkgJson.packageJson.type !== 'module') {
        throw new Error(
          'Not an ES module. This tool is for packages that use "type": "module".'
        )
      }

      pkgJson = pkgJson.packageJson
      babelProjectConfig = await loadPartialConfigAsync({ rootMode: values['root-mode'] })
    }
  } catch (err) {
    onError(err.message)
  }

  if (args?.values?.help) {
    logHelp('Usage: babel-dual-package [options] <files ...>\n')
    logHelp('Options:')
    logHelp(
      '--out-dir [out] \t\t Compile the modules in <files ...> into an output directory.'
    )
    logHelp(
      "--root-mode [mode] \t\t The project-root resolution mode. One of 'root' (the default), 'upward', or 'upward-optional'."
    )
    logHelp(
      '--cjs-dir-name [string] \t The name of the --out-dir subdirectory to output the CJS build. [cjs]'
    )
    logHelp(
      '--extensions [extensions] \t List of extensions to compile when a directory is part of the <files ...> input. [.js,.jsx,.mjs,.cjs]'
    )
    logHelp(
      '--out-file-extension [extmap] \t Use a specific extension for esm/cjs files. [esm:.js,cjs:.cjs]'
    )
    logHelp('--keep-file-extension \t\t Preserve the file extensions of the input files.')
    logHelp(
      '--no-cjs-dir \t\t\t Do not create a subdirectory for the CJS build in --out-dir.'
    )
    logHelp('--source-maps \t\t\t Generate an external source map.')
    logHelp('--minified  \t\t\t Save as many bytes when printing (false by default).')
    logHelp(
      '--copy-files \t\t\t When compiling a directory copy over non-compilable files.'
    )
    logHelp(`--help \t\t\t\t Output usage information (this information).`)
  }

  if (args && pkgJson && babelProjectConfig) {
    return {
      args,
      pkgJson,
      babelProjectConfig
    }
  }

  return false
}

export { init }
