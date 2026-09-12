// Bullet uses a zero-based, nonnegative track. Keep the signed display value separate.
export function bulletGeometry(value, target, maximum) {
  const finite = n => Number.isFinite(Number(n)) ? Number(n) : 0
  const val = finite(value), goal = finite(target)
  const auto = Math.max(val, goal, 0) * 1.2 || 1
  const max = finite(maximum) > 0 ? Number(maximum) : auto
  const percent = n => Math.max(0, Math.min(100, n / max * 100))
  return { valuePercent: percent(val), targetPercent: percent(goal) }
}
