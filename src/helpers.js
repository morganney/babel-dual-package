import { isRelative, hasJsExt, replaceJsExtWithCjs } from './util.js'

const resolveStringLiteral = (path) => {
  const { node } = path

  return node.extra?.raw ?? `"${node.value}"`
}
const resolveTemplateLiteral = (path) => {
  const { code } = path.hub.file
  const { start, end } = path.node

  return code.slice(start, end)
}
const resolveBinaryExpression = (path) => {
  return resolveTemplateLiteral(path)
}
/**
 * Gets the 'working' value of an AST node and whether that
 * value is considered a relative, e.g. './', or '../' prefix.
 *
 * Recursively called when the path represents an NewExpression node.
 */
const resolve = (path) => {
  if (path.isBinaryExpression({ operator: '+' })) {
    const value = resolveBinaryExpression(path)
    const collapsed = value.replace(/['"`+)\s]|new String\(/g, '')

    return { value, relative: isRelative(collapsed), jsExt: hasJsExt(collapsed) }
  }

  if (path.isTemplateLiteral()) {
    const value = resolveTemplateLiteral(path)

    return { value, relative: isRelative(value), jsExt: hasJsExt(value) }
  }

  if (path.isStringLiteral()) {
    const value = resolveStringLiteral(path)

    return { value, relative: isRelative(value), jsExt: hasJsExt(value) }
  }

  /**
   * NOTE: If nested, the outer `new String()` will be removed.
   */
  if (path.isNewExpression() && path.get('callee').isIdentifier({ name: 'String' })) {
    const newPath = path.get('arguments.0')

    return resolve(newPath)
  }

  return { value: '', relative: false, jsExt: false }
}
const updateExtensionsToCjs = (src, path, key = 'source') => {
  const property = path.get(key)
  const { value, relative, jsExt } = resolve(property)

  if (relative && jsExt) {
    /**
     * The node ranges ([node.start, node.end]) are
     * missing as this visitor is called during a
     * namespace export, e.g. `export * as ns from 'mod'`.
     *
     * Instead use the loc property which is present.
     */
    const { start, end } = property.node.loc

    src.update(start.index, end.index, replaceJsExtWithCjs(value))
  }
}

export { updateExtensionsToCjs }
