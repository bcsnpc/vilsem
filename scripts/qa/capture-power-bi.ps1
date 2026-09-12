param([Parameter(Mandatory=$true)][int]$ProcessId,[Parameter(Mandatory=$true)][string]$OutputPath)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class QaPowerBICapture { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r); public struct RECT {public int L,T,R,B;} }
"@
[QaPowerBICapture]::SetProcessDPIAware() | Out-Null
$qaHandle=(Get-Process -Id $ProcessId).MainWindowHandle
$qaRect=New-Object QaPowerBICapture+RECT
[QaPowerBICapture]::GetWindowRect($qaHandle,[ref]$qaRect) | Out-Null
$qaImage=New-Object System.Drawing.Bitmap(($qaRect.R-$qaRect.L),($qaRect.B-$qaRect.T))
$qaGraphics=[System.Drawing.Graphics]::FromImage($qaImage)
$qaDc=$qaGraphics.GetHdc()
[QaPowerBICapture]::PrintWindow($qaHandle,$qaDc,2) | Out-Null
$qaGraphics.ReleaseHdc($qaDc)
$qaImage.Save($OutputPath)
$qaGraphics.Dispose(); $qaImage.Dispose()
