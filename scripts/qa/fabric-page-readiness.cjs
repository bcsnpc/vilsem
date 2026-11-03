// Contracts for the deterministic QA gallery, not general visual validity.
const expectations = {
  'Visuals 1-6': { charts: 5, text: /84\.2k/ },
  'Visuals 7-12': { charts: 6 },
  'Visuals 13-18': { charts: 2, text: /Accessories/ },
  'Visuals 19-24': { charts: 0, text: /84\.2k/ },
  'Visuals 25-30': { charts: 4, text: /84\.2k/ },
  'Visuals 31-36': { charts: 1, text: /Quantity Sold/ },
  'Visuals 37-41': { charts: 1, text: /QA text bold/ },
}
function galleryPageReady(name, state) {
  const expected = expectations[name]
  return !!expected && !state.loading && state.charts >= expected.charts &&
    (!expected.text || expected.text.test(state.text))
}
module.exports = { galleryPageReady }
