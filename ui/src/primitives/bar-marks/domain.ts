// ECharts stacks positive and negative segments independently around zero.
export function barValueDomain(primary: number[], secondary: number[] | null, stacked: boolean) {
  let dataMin = 0, dataMax = 0
  primary.forEach((value, i) => {
    const other = secondary?.[i] ?? 0
    const low = stacked ? Math.min(value, 0) + Math.min(other, 0) : Math.min(value, other)
    const high = stacked ? Math.max(value, 0) + Math.max(other, 0) : Math.max(value, other)
    dataMin = Math.min(dataMin, low)
    dataMax = Math.max(dataMax, high)
  })
  return { dataMin, dataMax }
}
