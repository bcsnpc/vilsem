import { describe, it, expect } from 'vitest'
import readiness from '../scripts/qa/fabric-page-readiness.cjs'
const { galleryPageReady } = readiness
describe('Hosted gallery readiness', () => {
  it('rejects stable titles before asynchronous charts arrive', () => {
    expect(galleryPageReady('Visuals 1-6', { loading: false, charts: 0, text: 'QA bar' })).toBe(false)
    expect(galleryPageReady('Visuals 1-6', { loading: false, charts: 5, text: '84.2k' })).toBe(true)
  })
  it('requires data for the DOM-only page', () => {
    expect(galleryPageReady('Visuals 19-24', { loading: false, charts: 0, text: 'QA bullet' })).toBe(false)
    expect(galleryPageReady('Visuals 19-24', { loading: false, charts: 0, text: '84.2k' })).toBe(true)
  })
  it('rejects loading and unknown pages', () => {
    expect(galleryPageReady('Visuals 7-12', { loading: true, charts: 6, text: '' })).toBe(false)
    expect(galleryPageReady('Unknown', { loading: false, charts: 6, text: '' })).toBe(false)
  })
})
