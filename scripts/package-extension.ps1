[CmdletBinding()]
param(
    [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$workspaceRoot = (Resolve-Path (Join-Path $repoRoot "..")).Path

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $workspaceRoot "release"
}

$manifestPath = Join-Path $repoRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) {
    throw "Chrome Web Store packages must use Manifest V3."
}
if ([string]::IsNullOrWhiteSpace($manifest.version)) {
    throw "manifest.json does not contain a version."
}

$runtimeFiles = @(
    "manifest.json",
    "config.js",
    "background.js",
    "select.js",
    "editor.html",
    "editor-v2.css",
    "tokens.css",
    "editor.js",
    "github.js",
    "repositories.js",
    "auth-flow.js",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png"
)

foreach ($relativePath in $runtimeFiles) {
    $sourcePath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Required runtime file is missing: $relativePath"
    }
}

Push-Location $repoRoot
try {
    & npm run check
    if ($LASTEXITCODE -ne 0) {
        throw "JavaScript syntax checks failed."
    }

    & npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Extension tests failed."
    }
}
finally {
    Pop-Location
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$outputRoot = (Resolve-Path -LiteralPath $OutputDirectory).Path
$packageName = "pindart-v$($manifest.version).zip"
$packagePath = Join-Path $outputRoot $packageName
$checksumPath = "$packagePath.sha256"
$stagingPath = Join-Path $workspaceRoot (".package-staging-" + [guid]::NewGuid().ToString("N"))

try {
    New-Item -ItemType Directory -Path $stagingPath | Out-Null

    foreach ($relativePath in $runtimeFiles) {
        $sourcePath = Join-Path $repoRoot $relativePath
        $destinationPath = Join-Path $stagingPath $relativePath
        $destinationDirectory = Split-Path $destinationPath -Parent
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
    }

    if (Test-Path -LiteralPath $packagePath) {
        Remove-Item -LiteralPath $packagePath -Force
    }
    if (Test-Path -LiteralPath $checksumPath) {
        Remove-Item -LiteralPath $checksumPath -Force
    }

    Compress-Archive -Path (Join-Path $stagingPath "*") -DestinationPath $packagePath -CompressionLevel Optimal

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($packagePath)
    try {
        $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
        if ($entries -notcontains "manifest.json") {
            throw "Package verification failed: manifest.json is not at the ZIP root."
        }
        foreach ($relativePath in $runtimeFiles) {
            $archivePath = $relativePath.Replace("\", "/")
            if ($entries -notcontains $archivePath) {
                throw "Package verification failed: $archivePath is absent."
            }
        }
        if ($entries.Count -ne $runtimeFiles.Count) {
            $unexpected = $entries | Where-Object { $runtimeFiles -notcontains $_ }
            throw "Package verification failed: unexpected entries: $($unexpected -join ', ')"
        }
    }
    finally {
        $archive.Dispose()
    }

    $hash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath $checksumPath -Value "$hash  $packageName" -Encoding ascii

    Write-Host "Created: $packagePath"
    Write-Host "SHA-256: $hash"
    Write-Host "Version: $($manifest.version)"
    Write-Host "Files: $($runtimeFiles.Count)"
}
finally {
    if (Test-Path -LiteralPath $stagingPath) {
        $resolvedStaging = (Resolve-Path -LiteralPath $stagingPath).Path
        $workspacePrefix = $workspaceRoot.TrimEnd('\') + '\'
        if (-not $resolvedStaging.StartsWith($workspacePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove staging directory outside the workspace: $resolvedStaging"
        }
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
