param(
    [string]$ProjectRoot = "C:\BCA6FINELPROJECT\HomeDecor\Home-Decor"
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText(
        $Path,
        $Content,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$clientRoot = Join-Path $ProjectRoot "client"
$srcRoot = Join-Path $clientRoot "src"
$serverFile = Join-Path $ProjectRoot "server\server.js"

if (-not (Test-Path $srcRoot)) {
    throw "Client source folder not found: $srcRoot"
}
if (-not (Test-Path $serverFile)) {
    throw "Server file not found: $serverFile"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ProjectRoot "24hour-backup-$stamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

# Backup source and server before changing anything.
Copy-Item $srcRoot (Join-Path $backupRoot "src") -Recurse -Force
Copy-Item $serverFile (Join-Path $backupRoot "server.js") -Force

# A global frontend patch ensures every Date time display uses 24-hour format.
$utilsDir = Join-Path $srcRoot "utils"
New-Item -ItemType Directory -Path $utilsDir -Force | Out-Null
$force24File = Join-Path $utilsDir "force24Hour.js"

$force24Code = @'
// Forces all frontend Date/Intl time rendering to use 24-hour format.
// Imported once from main.jsx.
const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
const originalToLocaleString = Date.prototype.toLocaleString;
const OriginalDateTimeFormat = Intl.DateTimeFormat;

const forceOptions = (options = {}) => ({
  ...options,
  hour12: false,
});

Date.prototype.toLocaleTimeString = function (locales = "en-GB", options = {}) {
  return originalToLocaleTimeString.call(this, locales || "en-GB", forceOptions(options));
};

Date.prototype.toLocaleString = function (locales = "en-GB", options = {}) {
  return originalToLocaleString.call(this, locales || "en-GB", forceOptions(options));
};

Intl.DateTimeFormat = function (locales = "en-GB", options = {}) {
  return new OriginalDateTimeFormat(locales || "en-GB", forceOptions(options));
};
Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
Intl.DateTimeFormat.supportedLocalesOf = OriginalDateTimeFormat.supportedLocalesOf.bind(OriginalDateTimeFormat);
'@
Write-Utf8NoBom -Path $force24File -Content $force24Code

# Import the global patch once in the Vite entry file.
$mainCandidates = @(
    (Join-Path $srcRoot "main.jsx"),
    (Join-Path $srcRoot "main.js"),
    (Join-Path $srcRoot "main.tsx"),
    (Join-Path $srcRoot "main.ts")
)
$mainFile = $mainCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $mainFile) {
    throw "Could not find client/src/main.jsx (or main.js/main.tsx/main.ts)."
}

$mainContent = [System.IO.File]::ReadAllText($mainFile)
if ($mainContent -notmatch 'force24Hour') {
    $mainContent = "import `"./utils/force24Hour.js`";`r`n" + $mainContent
    Write-Utf8NoBom -Path $mainFile -Content $mainContent
}

# Convert every native time input to a direct 24-hour HH:MM field.
# Native browser time pickers can show AM/PM based on Windows locale and cannot be forced reliably.
$frontendFiles = Get-ChildItem $srcRoot -Recurse -File | Where-Object {
    $_.Extension -in @(".jsx", ".js", ".tsx", ".ts")
}

foreach ($file in $frontendFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $updated = $content

    $updated = [regex]::Replace(
        $updated,
        'type\s*=\s*["'']time["'']',
        'type="text" inputMode="numeric" placeholder="HH:MM" pattern="(?:[01]\\d|2[0-3]):[0-5]\\d" maxLength={5}',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    # Fix accidentally spaced JavaScript operators from copied files.
    $updated = [regex]::Replace($updated, '\?\s+\?', '??')
    $updated = [regex]::Replace($updated, '\?\s+\.', '?.')

    # Explicit 12-hour settings become 24-hour settings.
    $updated = [regex]::Replace($updated, 'hour12\s*:\s*true', 'hour12: false', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

    if ($updated -ne $content) {
        Write-Utf8NoBom -Path $file.FullName -Content $updated
    }
}

# Apply safe server-side fixes and force any explicit 12-hour formatting to 24-hour.
$serverContent = [System.IO.File]::ReadAllText($serverFile)
$serverContent = [regex]::Replace($serverContent, '\?\s+\?', '??')
$serverContent = [regex]::Replace($serverContent, '\?\s+\.', '?.')
$serverContent = [regex]::Replace($serverContent, 'hour12\s*:\s*true', 'hour12: false', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
Write-Utf8NoBom -Path $serverFile -Content $serverContent

Write-Host "Checking backend syntax..." -ForegroundColor Cyan
& node --check $serverFile
if ($LASTEXITCODE -ne 0) {
    throw "Backend syntax check failed. Backup is available at $backupRoot"
}

Write-Host "Building frontend..." -ForegroundColor Cyan
& npm --prefix $clientRoot run build
if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed. Backup is available at $backupRoot"
}

Write-Host "24-hour update completed successfully." -ForegroundColor Green
Write-Host "Backup: $backupRoot" -ForegroundColor Yellow

# Commit and push only after both checks pass.
& git -C $ProjectRoot add client/src server/server.js
& git -C $ProjectRoot commit -m "Use 24 hour format across website"
if ($LASTEXITCODE -ne 0) {
    Write-Host "No new Git changes to commit, or Git commit needs attention." -ForegroundColor Yellow
}
else {
    & git -C $ProjectRoot push origin main
    if ($LASTEXITCODE -ne 0) {
        throw "Git push failed. The code is updated locally and backup is at $backupRoot"
    }
    Write-Host "Pushed to GitHub. Vercel and Render should redeploy automatically." -ForegroundColor Green
}
