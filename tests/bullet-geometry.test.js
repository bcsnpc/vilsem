import { describe, it, expect } from 'vitest'
import { bulletGeometry } from '../ui/src/appspec/shared/bulletGeometry.js'
describe('Bullet nonnegative geometry', () => {
 it('preserves standard positive proportions', () => {
  expect(bulletGeometry(250,150,500)).toEqual({valuePercent:50,targetPercent:30})
  expect(bulletGeometry(250,150)).toEqual({valuePercent:250/300*100,targetPercent:50})
 })
 it('bounds negative, zero, over-range and nonfinite inputs', () => {
  for(const [value,target,max] of [[0,0,0],[-250,-100,500],[900,800,500],[Infinity,NaN,-1],[1,2,'']]) {
   for(const n of Object.values(bulletGeometry(value,target,max))) {expect(Number.isFinite(n)).toBe(true);expect(n).toBeGreaterThanOrEqual(0);expect(n).toBeLessThanOrEqual(100)}
  }
  expect(bulletGeometry(-250,-100,500)).toEqual({valuePercent:0,targetPercent:0})
 })
})
