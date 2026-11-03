param([Parameter(Mandatory=$true)][string]$OutputPath,
 [string]$ManifestPath="$PSScriptRoot/../../docs/qa/evidence/local-secondary-desktop-latest.json")
$ErrorActionPreference='Stop'
$qaLaunch=Get-Content -Raw $ManifestPath | ConvertFrom-Json
$qaProcess=Get-Process -Id $qaLaunch.processId
if($qaProcess.ProcessName -ne 'PBIDesktop'){throw 'Recorded QA process is not Power BI Desktop'}
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class VilsemQaCapture {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[VilsemQaCapture]::SetProcessDPIAware() | Out-Null
$qaHandle=$qaProcess.MainWindowHandle
$qaRect=New-Object VilsemQaCapture+Rect
if(-not [VilsemQaCapture]::GetWindowRect($qaHandle,[ref]$qaRect)){throw 'QA window bounds unavailable'}
$qaBitmap=New-Object Drawing.Bitmap(($qaRect.Right-$qaRect.Left),($qaRect.Bottom-$qaRect.Top))
$qaGraphics=[Drawing.Graphics]::FromImage($qaBitmap)
try {
 $qaDc=$qaGraphics.GetHdc()
 try { if(-not [VilsemQaCapture]::PrintWindow($qaHandle,$qaDc,2)){throw 'QA window capture failed'} } finally {$qaGraphics.ReleaseHdc($qaDc)}
 $qaBitmap.Save([IO.Path]::GetFullPath($OutputPath))
} finally {$qaGraphics.Dispose();$qaBitmap.Dispose()}
