/**
 * PBI Restyler — design knowledge index.
 *
 * Re-exports every knowledge module so consumers (audit engine, style
 * applier, design director, preview bridge, UI components) have one
 * canonical import path:
 *
 *   import { runAudit, getPreset, buildPlan, ... } from './knowledge'
 *
 * Modules:
 *   - pbirEnvelope      — PBIR `expr.Literal.Value` wrapping/unwrapping
 *   - visualTypeMap     — verified visualType strings + family taxonomy
 *   - pbiVisualSchema   — comprehensive map of formatting cards per visual
 *   - fontWhitelist     — Service-supported fonts + fallback chains
 *   - typography        — text class hierarchy + premium scale
 *   - structuralColors  — 6 structural color classes + light/dark ramps
 *   - colorTheory       — palette generation, contrast, k-means extraction
 *   - spacing           — 8pt grid + padding/gutter scale + page presets
 *   - chrome            — 4 chrome treatment presets
 *   - auditRules        — design audit rules engine (13 rules → score)
 *   - presets           — 4 named design plans
 *   - storyPatterns     — dashboard archetypes + auto-detection
 *   - visualPreference  — visual type selection + anti-patterns
 */

export * from './pbirEnvelope.js'
export * from './visualTypeMap.js'
export * from './pbiVisualSchema.js'
export * from './visualPropertyCatalog.js'
export * from './fontWhitelist.js'
export * from './typography.js'
export * from './structuralColors.js'
export * from './colorTheory.js'
export * from './spacing.js'
export * from './chrome.js'
export * from './auditRules.js'
export * from './presets.js'
export * from './storyPatterns.js'
export * from './visualPreference.js'
