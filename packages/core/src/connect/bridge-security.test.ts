import {it,expect} from 'vitest'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'

const source=fs.readFileSync(new URL('./localBridge.ps1',import.meta.url),'utf8')
const discovery=source.slice(source.indexOf(' # Only the official'),source.indexOf(' [Reflection.Assembly]::LoadFrom'))
it.each([
 {install:'C:\\OfficialDesktop',exists:true,expected:'C:\\OfficialDesktop\\bin\\Microsoft.PowerBI.AdomdClient.dll'},
 {install:'',exists:false,expected:'C:\\Program Files\\Microsoft Power BI Desktop\\bin\\Microsoft.PowerBI.AdomdClient.dll'},
 {install:'C:\\OfficialDesktop',exists:false,expected:'C:\\Program Files\\Microsoft Power BI Desktop\\bin\\Microsoft.PowerBI.AdomdClient.dll'},
])('pins ADOMD package discovery and falls back to the known DLL: $install / $exists',fixture=>{
 // Execute only discovery with mocked cmdlets: no package, DLL, network or
 // Desktop connection is accessed. The exact-name assertion rejects wildcards.
 const script=`$ErrorActionPreference='Stop'
 function Get-AppxPackage { [CmdletBinding()]param([string]$Name)
  if($Name -cne 'Microsoft.MicrosoftPowerBIDesktop'){throw 'Unexpected package name'}
  [pscustomobject]@{InstallLocation='${fixture.install}'}
 }
 function Test-Path {param([string]$LiteralPath) return $${fixture.exists}}
 ${discovery}
 $dll | ConvertTo-Json -Compress`
 const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true})
 expect(JSON.parse(output.trim())).toBe(fixture.expected)
},30000) // Each case starts a real PowerShell process, which can exceed 5 s under a parallel full-suite run.
it('keeps execution-policy bypass scoped to the fixed bundled script',()=>{
 const runtime=fs.readFileSync(new URL('./localRuntime.cjs',import.meta.url),'utf8')
 expect(runtime).toContain("'-ExecutionPolicy','Bypass','-File',path.join(__dirname,'localBridge.ps1')")
 expect(runtime).toContain('not change machine/user policy')
 expect(source).not.toContain("Get-AppxPackage '*PowerBI*'")
})
