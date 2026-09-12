// Plain clicks replace/toggle a single category; modifier clicks toggle membership.
export function nextCategorySelection(current, category, additive = false) {
  const values = current == null ? [] : Array.isArray(current) ? current : [current]
  if (!additive) return values.length === 1 && values[0] === category ? undefined : category
  const next = values.includes(category) ? values.filter(v => v !== category) : [...values, category]
  return next.length ? next : undefined
}
