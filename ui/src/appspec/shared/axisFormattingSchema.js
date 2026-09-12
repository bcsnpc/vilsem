// Unset fields preserve shared typography and renderer defaults.
export const axisFormattingSchema = ['xAxis', 'yAxis'].flatMap(axis => {
  const label = axis === 'xAxis' ? 'X' : 'Y'
  const group = `${label}-axis labels`
  return [
    { key: `${axis}LabelFamily`, label: `${label} label font`, group, type: 'font', default: '' },
    { key: `${axis}LabelWidth`, label: `${label} label width`, group, type: 'number', nullable: true, min: 10, max: 500, step: 1 },
    { key: `${axis}LabelOverflow`, label: `${label} label overflow`, group, type: 'select', default: '', options: [{value:'',label:'Default'},{value:'truncate',label:'Ellipsis'},{value:'break',label:'Wrap words'},{value:'breakAll',label:'Wrap characters'}] },
    { key: `${axis}LabelHideOverlap`, label: `${label} hide overlapping labels`, group, type: 'boolean', default: false },
    { key: `${axis}LabelColor`, label: `${label} label color`, group, type: 'color', default: '' },
    ...[['Size', 'size', 6, 48, 1], ['Weight', 'weight', 100, 900, 100], ['Rotation', 'rotation', -90, 90, 1], ['Spacing', 'spacing', 0, 48, 1]].map(([key, name, min, max, step]) => ({
      key: `${axis}Label${key}`, label: `${label} label ${name}`, group, type: 'number', nullable: true, min, max, step,
    })),
  ]
})
