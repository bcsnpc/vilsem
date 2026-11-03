import { copyFile, mkdir } from 'node:fs/promises'
const root = new URL('../../../', import.meta.url)
const metadata = await import(new URL('vilsem-renderer/pbiviz.json', root), { with: { type: 'json' } })
const { guid, version } = metadata.default.visual
await mkdir(new URL('../assets/', import.meta.url), { recursive: true })
await copyFile(new URL(`vilsem-renderer/dist/${guid}.${version}.pbiviz`, root), new URL('../assets/renderer.pbiviz', import.meta.url))
