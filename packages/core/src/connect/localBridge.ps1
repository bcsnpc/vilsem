$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$inputData=[Console]::In.ReadToEnd() | ConvertFrom-Json
try {
 if($inputData.action -eq 'sessions'){
  $sessions=@()
  foreach($engine in @(Get-CimInstance Win32_Process -Filter "Name='msmdsrv.exe'")){
   $desktop=Get-CimInstance Win32_Process -Filter "ProcessId=$($engine.ParentProcessId)"
   if($desktop.Name -ne 'PBIDesktop.exe'){continue}
   $folderMatch=[regex]::Match($engine.CommandLine,'-s\s+"([^"]+)"')
   $projectMatch=[regex]::Match($desktop.CommandLine,'"([^"]+\.pbip)"\s*$')
   if(-not $folderMatch.Success){continue}
   $portFile=Join-Path $folderMatch.Groups[1].Value 'msmdsrv.port.txt'
   if(-not(Test-Path -LiteralPath $portFile)){continue}
   $portValue=[int]([IO.File]::ReadAllText($portFile,[Text.Encoding]::Unicode).Trim())
   $sessions+=@{port=$portValue;projectPath=$projectMatch.Groups[1].Value;processId=$desktop.ProcessId;method='process-workspace-port-file'}
  }
  @{sessions=$sessions} | ConvertTo-Json -Depth 12 -Compress
  exit 0
 }
 $install=(Get-AppxPackage '*PowerBI*' | Select-Object -First 1).InstallLocation
 if(-not $install){$install='C:/Program Files/Microsoft Power BI Desktop'}
 [Reflection.Assembly]::LoadFrom((Join-Path $install 'bin/Microsoft.PowerBI.AdomdClient.dll')) | Out-Null
 $portValue=[int]$inputData.port
 if($portValue -lt 1 -or $portValue -gt 65535){throw 'Invalid local port.'}
 $conn=New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection
 $builder=New-Object System.Data.Common.DbConnectionStringBuilder
 $builder['Data Source']="localhost:$portValue";$builder['Integrated Security']='SSPI'
 if($inputData.catalog){$builder['Initial Catalog']=[string]$inputData.catalog}
 $conn.ConnectionString=$builder.ConnectionString;$conn.Open()
 function Schema-Rows([string]$name){
  $data=$conn.GetSchemaDataSet($name,$null);$rows=@()
  foreach($row in $data.Tables[0].Rows){$item=@{};foreach($col in $data.Tables[0].Columns){$item[$col.ColumnName]=if($row.IsNull($col)){$null}else{$row[$col]}};$rows+=,$item};return ,$rows
 }
 if($inputData.action -eq 'catalogs') { @{catalogs=(Schema-Rows 'DBSCHEMA_CATALOGS')} | ConvertTo-Json -Depth 12 -Compress }
 elseif($inputData.action -eq 'metadata') {
  $tables=Schema-Rows 'TMSCHEMA_TABLES';$columns=Schema-Rows 'TMSCHEMA_COLUMNS';$measures=Schema-Rows 'TMSCHEMA_MEASURES'
  # Return field metadata only; partition/data-source definitions stay in Desktop.
  @{tables=@($tables | ForEach-Object { @{id=$_.ID;name=$_.Name;isHidden=$_.IsHidden} });columns=@($columns | ForEach-Object { @{tableId=$_.TableID;name=$(if($_.ExplicitName){$_.ExplicitName}else{$_.InferredName});dataType=$(if($_.ExplicitDataType -gt 1){$_.ExplicitDataType}else{$_.InferredDataType});isHidden=$_.IsHidden} });measures=@($measures | ForEach-Object { @{tableId=$_.TableID;name=$_.Name;formatString=$_.FormatString;isHidden=$_.IsHidden} })} | ConvertTo-Json -Depth 12 -Compress
 } elseif($inputData.action -eq 'query') {
  $query=$conn.CreateCommand();$query.CommandText=[string]$inputData.dax;$query.CommandTimeout=30
  $reader=$query.ExecuteReader();$rows=@();$limit=if($inputData.maxRows){[int]$inputData.maxRows}else{100000}
  try { while($rows.Count -lt $limit -and $reader.Read()){ $row=@{};for($i=0;$i -lt $reader.FieldCount;$i++){ $row[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{ $cell=$reader.GetValue($i);if($cell -is [DateTime]){$cell.ToString('yyyy-MM-ddTHH:mm:ss.fffffff',[Globalization.CultureInfo]::InvariantCulture)}else{$cell} } };$rows+=,$row } } finally {$reader.Close();$query.Dispose()}
  @{rows=$rows} | ConvertTo-Json -Depth 12 -Compress
 } else {throw 'Unknown local operation.'}
} catch { @{error=$_.Exception.Message} | ConvertTo-Json -Compress;exit 1 } finally {if($conn){$conn.Dispose()}}
