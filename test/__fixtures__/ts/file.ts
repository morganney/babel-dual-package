interface Foo {
  bar: string;
  [k: string]: string;
}
import thing from './module.es.mjs'
import { common } from './common.foo.cjs'
import other from './other.ext.js'

export const foo: Foo = { bar: thing, other, common }
export type { Foo }
