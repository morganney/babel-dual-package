import { isRelative, hasJsExt, replaceJsExtWithOutExt } from './util.js'

const resolveStringLiteral = (path) => {
  const { node } = path

  return node.extra?.raw ?? `"${node.value}"`
}
const resolveTemplateLiteral = (path, source) => {
  const { start, end } = path.node

  return source.slice(start, end)
}
const resolveBinaryExpression = (path, source) => {
  return resolveTemplateLiteral(path, source)
}
/**
 * Gets the 'working' value of an AST node and whether that
 * value is considered a relative, e.g. './', or '../' prefix.
 *
 * Recursively called when the path represents an NewExpression node.
 */
const resolve = (path, source) => {
  if (path.isBinaryExpression({ operator: '+' })) {
    const value = resolveBinaryExpression(path, source)
    const collapsed = value.replace(/['"`+)\s]|new String\(/g, '')

    return { value, relative: isRelative(collapsed), jsExt: hasJsExt(collapsed) }
  }

  if (path.isTemplateLiteral()) {
    const value = resolveTemplateLiteral(path, source)

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

    return resolve(newPath, source)
  }

  return { value: '', relative: false, jsExt: false }
}
const updateSpecifierExtensions = ({
  esm,
  cjs,
  path,
  source,
  outFileExtension,
  key = 'source'
}) => {
  const property = path.get(key)
  const { value, relative, jsExt } = resolve(property, source)

  if (relative && jsExt) {
    const { start, end } = property.node.loc

    esm.update(
      start.index,
      end.index,
      replaceJsExtWithOutExt(value, outFileExtension.esm)
    )
    cjs.update(
      start.index,
      end.index,
      replaceJsExtWithOutExt(value, outFileExtension.cjs)
    )
  }
}
export { updateSpecifierExtensions }
