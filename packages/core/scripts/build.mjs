import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
await build({ entryPoints: { primitives: 'src/primitives/index.ts', compositions: 'src/compositions.ts', theme: 'src/shared/theme.ts' }, outdir: 'dist', bundle: true, platform: 'neutral', format: 'esm', target: 'es2022', sourcemap: true })
await mkdir('dist', { recursive: true })
await import('node:fs/promises').then(fs => fs.writeFile('dist/compositions.d.ts', 'export declare function composeOption(type: string, rows: any[], config: Record<string, any>, theme: any): any;\n'))
