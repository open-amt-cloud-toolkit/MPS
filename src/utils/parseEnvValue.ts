// Convert boolean strings to boolean
// And number strings to numbers.
// Need this to support ENV variables whose values are always strings
export function parseValue (val): number | boolean {
  if (!isNaN(val)) return parseInt(val)
  if (val.toLowerCase() === 'true') return true
  if (val.toLowerCase() === 'false') return false
  return val
}
