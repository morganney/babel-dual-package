import foo from '../test/__fixtures__/module.js'

const dynamicMod = 'module'
import(`../test/__fixtures__/${dynamicMod}.js`)

import { mjs } from '../test/__fixtures__/module.mjs'

import { cjs } from '../test/__fixtures__/module.cjs'

import json from '../test/__fixtures__/module.json' with { type: 'json' }

import(new String('../test/__fixtures__/' + new String('module.js')))

export const js = 'rocks'
