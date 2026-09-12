import { describe, it, expect } from 'vitest'
import { isLocalReportSource } from '../ui/src/pages/powerbi/outputPolicy.js'
describe('report output source restrictions', () => {
  it.each([
    [{ kind: 'local-pbip' }, null],
    [{ localSource: { kind: 'local-pbip' } }, null],
    [null, { _localSource: { modelPath: 'model' } }],
    [{ datasetId: 'local:123' }, null],
    [{ datasetId: 'fabric-id' }, { _localSource: { modelPath: 'model' } }],
  ])('keeps local reports out of cloud/web flows (%j)', (connection, spec) => {
    expect(isLocalReportSource(connection, spec)).toBe(true)
  })
  it('preserves Fabric output availability', () => {
    expect(isLocalReportSource({ datasetId: 'fabric-id' }, {})).toBe(false)
  })
  it('handles an unconnected editor', () => {
    expect(isLocalReportSource(null, null)).toBe(false)
  })
})
