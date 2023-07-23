import { mod } from 'specifier'

import foo from './bar.js'

import(`./${dynamicMod}.js`)

import { mjs } from './module.mjs'

import { cjs } from './module.cjs'

import(new String('./relative' + new String('module.js')))

export const js = 'rocks'
