// Feature flags for the Recharts → ECharts migration (Phase 2–5).
// Each flag gates one visual's rendering path. All flags are removed in Phase 6.
//
// Phase 4 close-out 2026-04-25: defaults flipped to TRUE. Every migrated visual
// now uses the ECharts primitive path by default. Existing users with explicit
// localStorage 'true' continue to see ECharts; users with no localStorage entry
// (incl. fresh standalone exports) also get ECharts. The toggle button in the
// topbar is now opt-OUT — clicking it sets localStorage to 'false' to roll back
// to Recharts (still available for emergencies until Phase 6 deletes the legacy
// files). Toggle pattern: set in DevTools console, then reload (or use the
// topbar button which writes for all flags at once and re-reads at render).

const LS_PREFIX = 'semantica.flags.'

function readFlag(name, envVar) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const envVal = import.meta.env[envVar]
      if (envVal === 'true') return true
      if (envVal === 'false') return false
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const lsVal = localStorage.getItem(LS_PREFIX + name)
      if (lsVal === 'true') return true
      if (lsVal === 'false') return false
    }
  } catch {}
  return true                              // default ON post-Phase 4 (was false during migration)
}

// Additive, isolated (Deploy-to-Fabric spike). Unlike readFlag (defaults ON post-
// Phase 4), this defaults OFF — the Fabric path must be invisible unless explicitly
// enabled via VITE_FEATURE_FABRIC_EXPORT=true or localStorage semantica.flags.fabricExport.
function readFlagDefaultOff(name, envVar) {
  try { if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[envVar] === 'true') return true } catch {}
  try { if (typeof localStorage !== 'undefined' && localStorage.getItem(LS_PREFIX + name) === 'true') return true } catch {}
  return false
}

export const FLAGS = {
  fabricExport:      readFlag('fabricExport', 'VITE_FEATURE_FABRIC_EXPORT'), // shipped feature, default ON (set VITE_FEATURE_FABRIC_EXPORT=false to hide)
  useEchartsRadar:   readFlag('useEchartsRadar',   'VITE_ECHARTS_RADAR'),
  useEchartsBar:     readFlag('useEchartsBar',     'VITE_ECHARTS_BAR'),
  useEchartsGauge:   true, // hardcoded for Phase 4.2 testing; restore readFlag() before Phase 6
  useEchartsScatter: readFlag('useEchartsScatter', 'VITE_ECHARTS_SCATTER'),
  useEchartsBubble:  readFlag('useEchartsBubble',  'VITE_ECHARTS_BUBBLE'),
  useEchartsTreemap: readFlag('useEchartsTreemap', 'VITE_ECHARTS_TREEMAP'),
  useEchartsDonut:   readFlag('useEchartsDonut',   'VITE_ECHARTS_DONUT'),
  useEchartsLine:    readFlag('useEchartsLine',    'VITE_ECHARTS_LINE'),
}
