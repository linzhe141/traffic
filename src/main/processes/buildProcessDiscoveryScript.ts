export function buildProcessDiscoveryScript(): string {
  return `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$windows = @{}
Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.MainWindowTitle) { $windows[$_.Id] = $_.MainWindowTitle }
}
$versions = @{}
$rows = @(Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object {
  $path = $_.ExecutablePath
  $version = $null
  if ($path) {
    if (-not $versions.ContainsKey($path)) {
      try { $versions[$path] = [Diagnostics.FileVersionInfo]::GetVersionInfo($path) }
      catch { $versions[$path] = $null }
    }
    $version = $versions[$path]
  }
  [pscustomobject]@{
    ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId
    Name = $_.Name; CommandLine = $_.CommandLine; ExecutablePath = $path
    MainWindowTitle = $windows[[int]$_.ProcessId]
    ProductName = $version.ProductName; FileDescription = $version.FileDescription
  }
})
ConvertTo-Json -InputObject $rows -Compress
`;
}
