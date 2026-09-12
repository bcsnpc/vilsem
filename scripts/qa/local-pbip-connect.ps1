param([Parameter(Mandatory=$true)][ValidateRange(1,65535)][int]$Port,[Parameter(Mandatory=$true)][string]$Catalog)
$ErrorActionPreference='Stop'
$pbiInstall=(Get-AppxPackage '*PowerBI*' | Select-Object -First 1).InstallLocation
[Reflection.Assembly]::LoadFrom((Join-Path $pbiInstall 'bin/Microsoft.PowerBI.AdomdClient.dll')) | Out-Null
$conn=New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection
$report=[ordered]@{scope='Read-only queries against a separate QA copy of AdventureWorks PBIP; no model mutation or refresh';port=$Port;catalog=$Catalog;checks=@()}
function Read-Query([string]$Dax) {
 $query=$conn.CreateCommand();$query.CommandText=$Dax;$query.CommandTimeout=30
 $reader=$query.ExecuteReader()
 try { $rows=@();while($reader.Read()) { $row=[ordered]@{};for($i=0;$i -lt $reader.FieldCount;$i++) { $row[$reader.GetName($i)] = if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)} };$rows+=,$row };return ,$rows } finally {$reader.Close();$query.Dispose()}
}
try {
 $conn.ConnectionString="Data Source=localhost:$Port;Initial Catalog=$Catalog;Integrated Security=SSPI;"
 $conn.Open()
 $report.checks+=@{name='Local engine connects';pass=$true}
 $totals=Read-Query 'EVALUATE ROW("Quantity Sold", [Quantity Sold], "Total Orders", [Total Orders])'
 $report.checks+=@{name='Existing measures evaluate';pass=($totals.Count -eq 1 -and $totals[0]['[Quantity Sold]'] -gt 0 -and $totals[0]['[Total Orders]'] -gt 0);rows=$totals}
 $grouped=Read-Query 'EVALUATE SUMMARIZECOLUMNS(''Product Categories Lookup''[CategoryName], "Quantity Sold", [Quantity Sold])'
 $report.checks+=@{name='Category binding returns grouped data';pass=($grouped.Count -gt 1);rows=$grouped}
 $filtered=Read-Query 'EVALUATE ROW("Quantity Sold", CALCULATE([Quantity Sold], TREATAS({"Bikes"}, ''Product Categories Lookup''[CategoryName])))'
 $bikeRow=$grouped | Where-Object { $_['Product Categories Lookup[CategoryName]'] -eq 'Bikes' }
 $report.checks+=@{name='Category filter matches grouped measure';pass=($null -ne $bikeRow -and $filtered[0]['[Quantity Sold]'] -eq $bikeRow['[Quantity Sold]']);rows=$filtered}
 $report.complete=$true
} catch { $report.error=$_.Exception.Message } finally { $conn.Dispose() }
$report | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 'D:/semantic_app/docs/qa/evidence/local-pbip-connection.json'
$report.checks | ForEach-Object { [PSCustomObject]$_ } | Select-Object name,pass | Format-Table
if($report.error){Write-Output $report.error;exit 1}
if(@($report.checks | Where-Object {-not $_.pass}).Count){exit 1}
