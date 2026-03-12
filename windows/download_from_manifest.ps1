param(
    [Parameter(Mandatory = $true)]
    [string]$ManifestPath,

    [string]$OutputRoot,

    [string]$PhotosDir,

    [string]$VideosDir,

    [double]$DelaySeconds = 0.2,

    [switch]$SkipExisting
)

$ErrorActionPreference = "Stop"

function Resolve-TargetDirectories {
    param(
        [string]$OutputRoot,
        [string]$PhotosDir,
        [string]$VideosDir
    )

    if (-not $OutputRoot -and (-not $PhotosDir -or -not $VideosDir)) {
        throw "Provide either -OutputRoot or both -PhotosDir and -VideosDir."
    }

    if ($OutputRoot) {
        $rootPath = [System.IO.Path]::GetPathRoot($OutputRoot)
        if ([string]::IsNullOrWhiteSpace($rootPath) -or -not (Test-Path -LiteralPath $rootPath)) {
            throw "Target drive does not exist: $rootPath"
        }
        $resolvedRoot = (Resolve-Path -LiteralPath $OutputRoot -ErrorAction SilentlyContinue)
        if (-not $resolvedRoot) {
            New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
            $resolvedRoot = Resolve-Path -LiteralPath $OutputRoot
        }
        if (-not $PhotosDir) {
            $PhotosDir = Join-Path $resolvedRoot.Path "photos"
        }
        if (-not $VideosDir) {
            $VideosDir = Join-Path $resolvedRoot.Path "videos"
        }
    }

    foreach ($path in @($PhotosDir, $VideosDir)) {
        $rootPath = [System.IO.Path]::GetPathRoot($path)
        if ([string]::IsNullOrWhiteSpace($rootPath) -or -not (Test-Path -LiteralPath $rootPath)) {
            throw "Target drive does not exist: $rootPath"
        }
    }

    New-Item -ItemType Directory -Force -Path $PhotosDir | Out-Null
    New-Item -ItemType Directory -Force -Path $VideosDir | Out-Null

    return @{
        PhotosDir = (Resolve-Path -LiteralPath $PhotosDir).Path
        VideosDir = (Resolve-Path -LiteralPath $VideosDir).Path
    }
}

function Get-ExtensionForItem {
    param(
        [string]$Url,
        [string]$Kind
    )

    $uri = [System.Uri]$Url
    $extension = [System.IO.Path]::GetExtension($uri.AbsolutePath)
    if ([string]::IsNullOrWhiteSpace($extension)) {
        if ($Kind -eq "photo") {
            return ".jpg"
        }
        return ".mp4"
    }
    return $extension.ToLowerInvariant()
}

if (!(Test-Path -LiteralPath $ManifestPath)) {
    throw "Manifest not found: $ManifestPath"
}

$targets = Resolve-TargetDirectories -OutputRoot $OutputRoot -PhotosDir $PhotosDir -VideosDir $VideosDir
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$items = @($manifest.items)

if ($items.Count -eq 0) {
    throw "Manifest does not contain any items."
}

$photosDownloaded = 0
$videosDownloaded = 0
$skipped = 0
$failed = 0
$index = 0

foreach ($item in $items) {
    $index++

    $id = [string]$item.id
    $kind = [string]$item.kind
    $url = [string]$item.download_url

    if ([string]::IsNullOrWhiteSpace($id) -or [string]::IsNullOrWhiteSpace($url) -or ($kind -ne "photo" -and $kind -ne "video")) {
        Write-Host "[$index/$($items.Count)] invalid manifest item"
        $failed++
        continue
    }

    $targetDir = if ($kind -eq "photo") { $targets.PhotosDir } else { $targets.VideosDir }
    $extension = Get-ExtensionForItem -Url $url -Kind $kind
    $destination = Join-Path $targetDir ($id + $extension)

    Write-Host "[$index/$($items.Count)] $kind -> $destination"

    if ($SkipExisting -and (Test-Path -LiteralPath $destination)) {
        Write-Host "  skipped existing"
        $skipped++
        continue
    }

    try {
        Invoke-WebRequest -Uri $url -OutFile $destination -Headers @{
            "User-Agent" = "Mozilla/5.0"
            "Referer"    = "https://www.pexels.com/"
        } | Out-Null
    } catch {
        $message = $_.Exception.Message
        if ($message -match "There is not enough space on the disk" -or $message -match "not enough space") {
            Write-Host "  failed: no space left on the target drive. Free up disk space and rerun with -SkipExisting."
        } else {
            Write-Host "  failed: $message"
        }
        $failed++
        continue
    }

    if ($kind -eq "photo") {
        $photosDownloaded++
    } else {
        $videosDownloaded++
    }

    if ($DelaySeconds -gt 0) {
        Start-Sleep -Milliseconds ([int]($DelaySeconds * 1000))
    }
}

Write-Host "Summary"
Write-Host "  photos_downloaded: $photosDownloaded"
Write-Host "  videos_downloaded: $videosDownloaded"
Write-Host "  skipped: $skipped"
Write-Host "  failed: $failed"
if ($failed -eq 0) {
    Write-Host "All files were downloaded successfully."
}
Write-Host "Built by Mert Can Girgin"
Write-Host "MSc | DevOps Engineer | Linux Administrator"
Write-Host "Guardian of the Linux realms. No outage shall pass."
