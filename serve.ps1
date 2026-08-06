# Minimal static file server for local preview.
# No dependencies - uses the .NET HttpListener built into Windows.
#
#   powershell -ExecutionPolicy Bypass -File serve.ps1
#   powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8080
#
# Stop with Ctrl+C.

param([int]$Port = 5173)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootFull = [System.IO.Path]::GetFullPath($root)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff2'= 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $rootFull"
Write-Host "  -> http://localhost:$Port/"
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response

    try {
      $rel = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
      if ($rel -eq '/') { $rel = '/index.html' }

      $candidate = Join-Path $rootFull ($rel.TrimStart('/') -replace '/', '\')
      $full = [System.IO.Path]::GetFullPath($candidate)

      # Refuse anything that escapes the served directory.
      if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
        $response.StatusCode = 403
        $body = [System.Text.Encoding]::UTF8.GetBytes('403 Forbidden')
      }
      elseif (Test-Path -LiteralPath $full -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
        $type = $mime[$ext]
        if (-not $type) { $type = 'application/octet-stream' }
        $response.ContentType = $type
        $response.Headers.Add('Cache-Control', 'no-store')
        $body = [System.IO.File]::ReadAllBytes($full)
        $response.StatusCode = 200
      }
      else {
        $response.StatusCode = 404
        $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      }

      $response.ContentLength64 = $body.Length
      $response.OutputStream.Write($body, 0, $body.Length)
      Write-Host ("{0} {1}" -f $response.StatusCode, $rel)
    }
    catch {
      Write-Host ("ERROR {0}" -f $_.Exception.Message)
    }
    finally {
      $response.Close()
    }
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
