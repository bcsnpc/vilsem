// Allocate the fixed 100-cell grid by largest remainder. Ties retain row order.
// Preserve the waffle's existing magnitude-based treatment of negative values.
export function allocateWaffleCells(values) {
  const weights = values.map(value => Number.isFinite(Number(value)) ? Math.abs(Number(value)) : 0)
  const max = weights.reduce((largest, value) => Math.max(largest, value), 0)
  if (!max) return weights.map(() => 0)
  // Normalize first so several large finite measures cannot overflow the total.
  const normalized = weights.map(value => value / max)
  const total = normalized.reduce((sum, value) => sum + value, 0)
  const shares = normalized.map(value => value / total * 100)
  const counts = shares.map(Math.floor)
  const order = shares.map((share, index) => ({ index, remainder: share - counts[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  const remaining = 100 - counts.reduce((sum, count) => sum + count, 0)
  for (let i = 0; i < remaining; i++) counts[order[i].index]++
  return counts
}
