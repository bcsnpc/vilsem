import { describe, it, expect } from 'vitest';
import { translateToDAX, parseFilterKey, buildFilterExpression } from '../src/fabric/translator.js';

describe('parseFilterKey', () => {
  it('parses a valid filter key', () => {
    const result = parseFilterKey('Region[Name]');
    expect(result).toEqual({ table: 'Region', column: 'Name' });
  });

  it('parses a filter key with spaces in table name', () => {
    const result = parseFilterKey('Sales Region[Name]');
    expect(result).toEqual({ table: 'Sales Region', column: 'Name' });
  });

  it('throws INVALID_FILTER for malformed key', () => {
    expect(() => parseFilterKey('InvalidKey')).toThrow('INVALID_FILTER');
  });

  it('throws INVALID_FILTER for missing closing bracket', () => {
    expect(() => parseFilterKey('Region[Name')).toThrow('INVALID_FILTER');
  });
});

describe('buildFilterExpression', () => {
  it('builds a string filter expression', () => {
    const result = buildFilterExpression('Region[Name]', 'East');
    expect(result).toBe("FILTER('Region', 'Region'[Name] = \"East\")");
  });

  it('builds a number filter expression', () => {
    const result = buildFilterExpression('Date[Year]', 2025);
    expect(result).toBe("FILTER('Date', 'Date'[Year] = 2025)");
  });
});

describe('translateToDAX', () => {
  it('translates measures only (no filters)', () => {
    const dax = translateToDAX(['Total Revenue']);
    expect(dax).toContain('EVALUATE SUMMARIZECOLUMNS(');
    expect(dax).toContain('"Total Revenue", [Total Revenue]');
  });

  it('translates measures with parentheses in name', () => {
    const dax = translateToDAX(['Matches (Smart)']);
    expect(dax).toContain('"Matches (Smart)", [Matches (Smart)]');
  });

  it('translates measures with filters', () => {
    const dax = translateToDAX(
      ['Total Revenue', 'Gross Margin %'],
      { 'Date[Year]': 2025, 'Region[Name]': 'East' }
    );
    expect(dax).toContain("FILTER('Date', 'Date'[Year] = 2025)");
    expect(dax).toContain("FILTER('Region', 'Region'[Name] = \"East\")");
    expect(dax).toContain('"Total Revenue", [Total Revenue]');
    expect(dax).toContain('"Gross Margin %", [Gross Margin %]');
  });

  it('throws VALIDATION_ERROR when no measures provided', () => {
    expect(() => translateToDAX([])).toThrow('VALIDATION_ERROR');
    expect(() => translateToDAX(null)).toThrow('VALIDATION_ERROR');
  });

  it('generates valid EVALUATE SUMMARIZECOLUMNS structure', () => {
    const dax = translateToDAX(['Orders Count'], { 'Date[Year]': 2025 });
    expect(dax).toMatch(/^EVALUATE SUMMARIZECOLUMNS\(/);
    expect(dax).toMatch(/\)$/);
  });
});
