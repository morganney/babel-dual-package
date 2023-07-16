import { argv, versions } from 'node:process'
import { parseArgs } from 'node:util'

import { readPackageUp } from 'read-pkg-up'
import { loadPartialConfigAsync } from '@babel/core'

import { logHelp } from './util.js'

const init = async (onError = () => {}) => {
  let pkgJson = null
  let args = null
  let babelConfig = null

  try {
    if (parseFloat(versions.node) < 16.19) {
      throw new Error('This script requires a Node version >= 16.19.0')
    }

    const { values, positionals } = parseArgs({
      argv,
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
        extensions: {
          type: 'string',
          default: '.js,.jsx,.mjs,.cjs'
        },
        'out-file-extension': {
          type: 'string',
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
        }
      }
    })

    args = { values, positionals }

    if (!values.help) {
      if (values['keep-file-extension'] && values['out-file-extension']) {
        throw new Error(
          '--keep-file-extension and --out-file-extension are mutually exclusive.'
        )
      }

      if (!positionals.length) {
        throw new Error('No filenames found. Did you forget to pass <files ...>?')
      }

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
      babelConfig = await loadPartialConfigAsync()
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
      '--cjs-dir-name [string] \t The name of the --out-dir subdirectory to output the CJS build. [cjs]'
    )
    logHelp(
      '--extensions [extensions] \t List of extensions to compile when a directory is part of the <files ...> input. [.js,.jsx,.mjs,.cjs]'
    )
    logHelp(
      '--out-file-extension [string] \t Use a specific extension for the output files.'
    )
    logHelp('--keep-file-extension \t\t Preserve the file extensions of the input files.')
    logHelp(
      '--no-cjs-dir \t\t\t Do not create a subdirectory for the CJS build in --out-dir.'
    )
    logHelp(`--help \t\t\t\t Output usage information (this information).`)
  }

  if (args && pkgJson && babelConfig) {
    return {
      args,
      pkgJson,
      babelConfig
    }
  }

  return false
}

export { init }
