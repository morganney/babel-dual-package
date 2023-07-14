# [`babel-dual-package`](https://www.npmjs.com/package/babel-dual-package)

![CI](https://github.com/morganney/babel-dual-package/actions/workflows/ci.yml/badge.svg)
[![NPM version](https://img.shields.io/npm/v/babel-dual-package.svg)](https://www.npmjs.com/package/babel-dual-package)

CLI for building a [dual ESM and CJS package](https://nodejs.org/api/packages.html#dual-commonjses-module-packages) with babel. Specifically, takes an ES module and produces a compiled ESM and CJS output using the configuration from your `babel.config.json` file (or a sensible default configuration).

## Requirements

* Node >= 20.1.0 (for now).
* Your package uses `"type": "module"` in package.json.

## Getting Started

First install `babel-dual-package`:

```
npm install babel-dual-package
```

Next ... _WIP_

## Example

_WIP_

Given this example setup:

**babel.config.json**
```json
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false
    }],
    "@babel/preset-typescript"
  ]
}
```

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "es6",
    "module": "esnext",
    "moduleResolution": "nodenext",
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationDir": "dist",
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**tsconfig.cjs.json**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "declarationDir": "dist/cjs"
  },
  "include": ["src"]
}
```

**package.json**
```json
  "type": "module",
  "scripts": {
    "build:types": "tsc && tsc -p ./tsconfig.cjs.json",
    "build:dual": "babel-dual-package --out-dir dist --extensions .js,.ts src",
    "build": "npm run build:types && npm run build:dual"
  }
```

You will get output of an ESM build directly inside `dist`, a CJS build at `dist/cjs`, and all import/export sources as well as filenames using the correct extensions. Moreover, the declaration (.d.ts) files will also have their extensions updated correctly.

## Options

_WIP_

There are options that can be passed to provide custom output locations, file extensions, and more.

You can run `./node_modules/.bin/babel-dual-package --help` to get more info.
