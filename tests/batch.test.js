import { describe, it, expect } from 'vitest';

describe('batch merge logic', () => {
  function groupByFilters(queries) {
    const groups = new Map();
    for (const q of queries) {
      const filterKey = JSON.stringify(
        Object.keys(q.filters || {}).sort().reduce((acc, k) => {
          acc[k] = (q.filters || {})[k];
          return acc;
        }, {})
      );
      if (!groups.has(filterKey)) {
        groups.set(filterKey, { filters: q.filters || {}, queries: [] });
      }
      groups.get(filterKey).queries.push(q);
    }
    return groups;
  }

  function splitResults(combinedData, queries) {
    const results = {};
    for (const q of queries) {
      const queryData = {};
      for (const m of q.measures) {
        queryData[m] = combinedData[m] !== undefined ? combinedData[m] : null;
      }
      results[q.id] = { data: queryData, source: 'fabric' };
    }
    return results;
  }

  it('groups queries with identical filters together', () => {
    const queries = [
      { id: 'a', measures: ['M1'], filters: { 'T[X]': 1 } },
      { id: 'b', measures: ['M2'], filters: { 'T[X]': 1 } },
      { id: 'c', measures: ['M3'], filters: { 'T[Y]': 2 } },
    ];
    const groups = groupByFilters(queries);
    expect(groups.size).toBe(2);
  });

  it('groups queries with no filters together', () => {
    const queries = [
      { id: 'a', measures: ['M1'], filters: {} },
      { id: 'b', measures: ['M2'], filters: {} },
    ];
    const groups = groupByFilters(queries);
    expect(groups.size).toBe(1);
    const group = [...groups.values()][0];
    expect(group.queries.length).toBe(2);
  });

  it('correctly splits combined response back to individual queries', () => {
    const combinedData = { 'Total Revenue': 4820000, 'Gross Margin %': 0.341 };
    const queries = [
      { id: 'revenue', measures: ['Total Revenue'] },
      { id: 'margin', measures: ['Gross Margin %'] },
    ];
    const results = splitResults(combinedData, queries);
    expect(results.revenue.data).toEqual({ 'Total Revenue': 4820000 });
    expect(results.margin.data).toEqual({ 'Gross Margin %': 0.341 });
  });

  it('returns null for missing measures in combined response', () => {
    const combinedData = { 'Total Revenue': 4820000 };
    const queries = [
      { id: 'test', measures: ['Total Revenue', 'Missing Measure'] },
    ];
    const results = splitResults(combinedData, queries);
    expect(results.test.data['Total Revenue']).toBe(4820000);
    expect(results.test.data['Missing Measure']).toBeNull();
  });

  it('handles filter key order deterministically', () => {
    const queries1 = [
      { id: 'a', measures: ['M1'], filters: { 'T[Y]': 2, 'T[X]': 1 } },
    ];
    const queries2 = [
      { id: 'b', measures: ['M1'], filters: { 'T[X]': 1, 'T[Y]': 2 } },
    ];
    const groups1 = groupByFilters(queries1);
    const groups2 = groupByFilters(queries2);
    const key1 = [...groups1.keys()][0];
    const key2 = [...groups2.keys()][0];
    expect(key1).toBe(key2);
  });
});
