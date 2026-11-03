import powerbiVisualsConfigs from 'eslint-plugin-powerbi-visuals'

// Match the installed Power BI packaging tool's recommended rules.
export default [
  powerbiVisualsConfigs.configs.recommended,
  // Generated bundle includes third-party React internals (DOM namespaces,
  // arguments, framework HTML support). Review/lint authored sources instead.
  { ignores: ['node_modules/**', 'dist/**', '.tmp/**', 'generated/**'] },
]
