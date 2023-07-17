# [`babel-dual-package`](https://www.npmjs.com/package/babel-dual-package)

![CI](https://github.com/morganney/babel-dual-package/actions/workflows/ci.yml/badge.svg)
[![NPM version](https://img.shields.io/npm/v/babel-dual-package.svg)](https://www.npmjs.com/package/babel-dual-package)

CLI for building a [dual ESM and CJS package](https://nodejs.org/api/packages.html#dual-commonjses-module-packages) with Babel. Takes an ES module and produces a compiled ESM and CJS build using the configuration from your `babel.config.json` file.

## Requirements

* Node >= 16.19.0.
* Your package uses `"type": "module"` in package.json (converting from CJS to ESM is a codemod, not transpiling via Babel).

## Getting Started

First install `babel-dual-package`:

```
npm install babel-dual-package
```

Next write your `babel.config.json` file and include any plugins or presets your project requires.

```json
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false
    }]
  ]
}
```

Now run `babel-dual-package src` to get an ESM and CJS build in a `dist` directory that can be used as `exports` in a package.json file.

Run `babel-dual-package --help` to see a list of more [options](#options).

## Examples

### TypeScript and JSX

If your project is using typescript then add `@babel/preset-typescript`. If it is also using JSX, then add `@babel/preset-react`.

**babel.config.json**
```json
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false
    }],
    "@babel/preset-typescript"
    ["@babel/preset-react", {
      "runtime": "automatic"
    }]
  ]
}
```

Set the `declarationDir` for your types to the same value used for `--out-dir`, or `dist` (the default) if not using `--out-dir`.

**tsconfig.json**
```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "dist",
    "emitDeclarationOnly": true,
    "isolatedModules": true,
    "strict": true
  },
  "include": ["src"]
}
```

In order to support typescript, you must pass the `--extensions` used:

```
babel-dual-package --out-dir dist --extensions .ts,.tsx src
```

If everything worked you should get an ESM build in `dist` and a CJS build in `dist/cjs` with all extensions in the filenames, and `import`/`export` sources updated correctly.

Now you can add some scripts to your package.json file to help automate the build during CI/CD.

**package.json**
```json
  "type": "module",
  "scripts": {
    "build:types": "tsc --emitDeclarationOnly",
    "build:dual": "babel-dual-package --out-dir dist --extensions .ts,.tsx src",
    "build": "npm run build:types && npm run build:dual"
  }
```

### Flat build with `.js` extension

Given a directory structure like the following,

```
app/
  package.json
  src/
    one/
      file1.js
    two/
      file2.js
    file.js
```

and by using `--out-file-extension` to make sure each build has unique filenames, you can create a flat build while still supporting conditional exports.

For example, running

```
babel-dual-package --no-cjs-dir --out-file-extension esm:.esm.js,cjs:.cjs.js src/*.js src/one src/two
```

Will produce the following build output:

```
dist/
  file.esm.js
  file.cjs.js
  file1.esm.js,
  file1.cjs.js,
  file2.esm.js,
  file2.cjs.js
```

## Options

There are options that can be passed to provide custom output locations, file extensions, and more.

You can run `babel-dual-package --help` to get more info. Below is the output of that:

```
Usage: babel-dual-package [options] <files ...>

Options:
--out-dir [out] 		 Compile the modules in <files ...> into an output directory.
--root-mode [mode] 		 The project-root resolution mode. One of 'root' (the default), 'upward', or 'upward-optional'.
--cjs-dir-name [string] 	 The name of the --out-dir subdirectory to output the CJS build. [cjs]
--extensions [extensions] 	 List of extensions to compile when a directory is part of the <files ...> input. [.js,.jsx,.mjs,.cjs]
--out-file-extension [extmap] 	 Use a specific extension for esm/cjs files. [esm:.js,cjs:.cjs]
--keep-file-extension 		 Preserve the file extensions of the input files.
--no-cjs-dir 			 Do not create a subdirectory for the CJS build in --out-dir.
--source-maps 			 Generate an external source map.
--minified  			 Save as many bytes when printing (false by default).
--help 				 Output usage information (this information).
```
