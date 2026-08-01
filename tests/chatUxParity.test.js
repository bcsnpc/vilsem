/**
 * Chat-UX parity test — enforces the 2026-04-20 cluster:
 *   1. Inspector + chat refine route through the same helper (refineSpec)
 *   2. Replace/Refine toggle guards wipe with a confirm dialog
 *   3. Provider/Model are two dropdowns, not Auto/Quality/Economy
 *
 * Fails fast if any of these split back into divergent code paths.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const REPO = path.resolve(__dirname, '..')
const APP_GEN = fs.readFileSync(path.join(REPO, 'ui/src/pages/AppGenerator.jsx'), 'utf-8')

describe('Chat UX — refine pipeline unified', () => {
  it('defines a single refineSpec() helper both paths route through', () => {
    expect(APP_GEN).toMatch(/async\s+function\s+refineSpec\s*\(/)
  })

  it('refineSpec accepts scopedVisualId so inspector can target a single visual', () => {
    expect(APP_GEN).toMatch(/scopedVisualId/)
  })

  it('chat refine (handleRefine) delegates to refineSpec, not its own patchAppSpec call', () => {
    const handleRefineBlock = APP_GEN.match(/async\s+function\s+handleRefine\s*\(\)[^}]*\}/)
    expect(handleRefineBlock).not.toBeNull()
    expect(handleRefineBlock[0]).toMatch(/refineSpec\(/)
    // It must not call the IPC directly — that's refineSpec's job now
    expect(handleRefineBlock[0]).not.toMatch(/window\.semantica\.patchAppSpec/)
  })

  it('inspector onAiRefine delegates to refineSpec with scopedVisualId', () => {
    // The onAiRefine callback passed to VisualInspector should now call refineSpec
    const onAiRefineBlock = APP_GEN.match(/onAiRefine=\{[^}]+refineSpec\([^)]+scopedVisualId/)
    expect(onAiRefineBlock).not.toBeNull()
  })

  it('no inspector inline call to patchAppSpec (all refines go via refineSpec)', () => {
    // The prior split path was onAiRefine={async (prompt) => { ... window.semantica.patchAppSpec(...) }}
    // There's now only one patchAppSpec call-site: inside refineSpec.
    const calls = APP_GEN.match(/window\.semantica\.patchAppSpec/g) || []
    expect(calls.length).toBe(1)
  })
})

describe('Chat UX — Replace/Refine toggle', () => {
  it('has chatMode state with refine default', () => {
    expect(APP_GEN).toMatch(/useState\(['"]refine['"]\)/)
  })

  it('has replaceConfirm state for the wipe confirmation dialog', () => {
    expect(APP_GEN).toMatch(/setReplaceConfirm/)
  })

  it('exposes a unified handleChatSubmit that routes by chatMode', () => {
    expect(APP_GEN).toMatch(/async\s+function\s+handleChatSubmit/)
  })

  it('Replace mode with existing spec triggers the confirm dialog (no silent wipe)', () => {
    // Find handleChatSubmit's body — grab the next ~60 lines after the declaration
    // (the function itself contains nested braces, so a bracket-balanced
    // match is fiddly; this chunk is plenty to cover its body).
    const startIdx = APP_GEN.indexOf('async function handleChatSubmit')
    expect(startIdx).toBeGreaterThan(-1)
    const block = APP_GEN.slice(startIdx, startIdx + 1500)
    expect(block).toMatch(/setReplaceConfirm/)
    expect(block).toMatch(/chatMode === ['"]refine['"]/)
  })

  it('confirmReplace is the function the dialog button fires', () => {
    expect(APP_GEN).toMatch(/async\s+function\s+confirmReplace/)
  })
})

describe('Chat UX — Provider + Model dropdowns', () => {
  it('removed the Auto/Quality/Economy GENERATION_MODES array', () => {
    expect(APP_GEN).not.toMatch(/GENERATION_MODES/)
    // Word-bounded — selectedMode is gone, but selectedModel (which contains
    // "selectedMode" as a substring) is expected.
    expect(APP_GEN).not.toMatch(/\bselectedMode\b/)
    expect(APP_GEN).not.toMatch(/\bactiveMode\b/)
  })

  it('has a PROVIDERS list covering all 4 providers', () => {
    expect(APP_GEN).toMatch(/PROVIDERS\s*=\s*\[/)
    for (const id of ['anthropic', 'openai', 'gemini', 'groq']) {
      expect(APP_GEN).toMatch(new RegExp(`id:\\s*['"]${id}['"]`))
    }
  })

  it('has selectedProvider + selectedModel state', () => {
    expect(APP_GEN).toMatch(/selectedProvider/)
    expect(APP_GEN).toMatch(/selectedModel/)
  })

  it('loads models via window.semantica.getAiModels', () => {
    expect(APP_GEN).toMatch(/window\.semantica\.getAiModels/)
  })

  it('passes { provider, model } to generateAppSpec (not mode)', () => {
    const genCall = APP_GEN.match(/generateAppSpec\(\{[\s\S]*?\}\)/)
    expect(genCall).not.toBeNull()
    expect(genCall[0]).toMatch(/provider:\s*selectedProvider/)
    expect(genCall[0]).toMatch(/model:\s*selectedModel/)
    expect(genCall[0]).not.toMatch(/mode:\s*selectedMode/)
  })
})
