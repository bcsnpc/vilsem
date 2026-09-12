import { it, expect } from 'vitest'
import { nextCategorySelection as next } from '../ui/src/appspec/shared/categorySelection.js'
it('preserves plain-click replacement and repeat deselection',()=>{expect(next('A','B')).toBe('B');expect(next('A','A')).toBeUndefined();expect(next(['A','B'],'B')).toBe('B')})
it('adds, removes and clears modifier selections without mutation',()=>{const initial=['A'];expect(next(initial,'B',true)).toEqual(['A','B']);expect(initial).toEqual(['A']);expect(next(['A','B'],'A',true)).toEqual(['B']);expect(next(['B'],'B',true)).toBeUndefined();expect(next(null,'A',true)).toEqual(['A'])})
