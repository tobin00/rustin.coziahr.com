$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot
$failures = 0
$warnings = 0

function Write-Pass([string]$Message) {
    Write-Host "[OK]      $Message" -ForegroundColor Green
}

function Write-Action([string]$Message) {
    $script:failures++
    Write-Host "[ACTION]  $Message" -ForegroundColor Yellow
}

function Write-Warning([string]$Message) {
    $script:warnings++
    Write-Host "[NOTE]    $Message" -ForegroundColor Cyan
}

function Get-NativeOutput([scriptblock]$Command) {
    $result = & $Command 2>&1
    return (($result | Out-String).Trim())
}

Write-Host ""
Write-Host "Rustin website setup check" -ForegroundColor White
Write-Host "This only checks the laptop. It does not install or change anything."
Write-Host ""

$gitReady = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
if ($gitReady) {
    Write-Pass (Get-NativeOutput { git --version })
} else {
    Write-Action "Git is missing. Install Git for Windows, then restart the computer."
}

$nodeReady = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
if ($nodeReady) {
    $nodeVersion = Get-NativeOutput { node --version }
    $nodeMajor = [int](($nodeVersion -replace '^v', '').Split('.')[0])
    if ($nodeMajor -ge 20) {
        Write-Pass "Node.js $nodeVersion"
    } else {
        Write-Action "Node.js $nodeVersion is too old. Install the current Node.js LTS release."
        $nodeReady = $false
    }
} else {
    Write-Action "Node.js is missing. Install the current Node.js LTS release."
}

$npmReady = $null -ne (Get-Command npm -ErrorAction SilentlyContinue)
if ($npmReady) {
    Write-Pass "npm $(Get-NativeOutput { npm --version })"
} else {
    Write-Action "npm is missing. Reinstall the current Node.js LTS release."
}

$ghReady = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)
if ($ghReady) {
    $ghVersion = (Get-NativeOutput { gh --version }).Split([Environment]::NewLine)[0]
    Write-Pass $ghVersion
    & gh auth status --hostname github.com *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Signed in to GitHub"
        $permission = Get-NativeOutput { gh repo view tobin00/rustin.coziahr.com --json viewerPermission --jq '.viewerPermission' }
        if ($LASTEXITCODE -eq 0 -and $permission -in @("WRITE", "MAINTAIN", "ADMIN")) {
            Write-Pass "GitHub access can publish changes ($permission permission)"
        } else {
            Write-Action "This GitHub account cannot publish yet. Accept the collaborator invitation or ask Tobin to add the account."
        }
    } else {
        Write-Action "GitHub CLI is not signed in. Run: gh auth login"
    }
} else {
    Write-Action "GitHub CLI is missing. Install it, restart the computer, then run: gh auth login"
}

Push-Location $repoRoot
try {
    if ($gitReady) {
        & git rev-parse --is-inside-work-tree *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "This folder is a Git repository"
            $remote = Get-NativeOutput { git remote get-url origin }
            if ($LASTEXITCODE -eq 0 -and $remote -match 'tobin00/rustin\.coziahr\.com') {
                Write-Pass "Connected to the correct GitHub repository"
            } else {
                Write-Action "The origin remote is missing or points to the wrong repository."
            }

            $gitName = Get-NativeOutput { git config user.name }
            $gitEmail = Get-NativeOutput { git config user.email }
            if ($gitName -and $gitEmail) {
                Write-Pass "Git commits will be saved as $gitName <$gitEmail>"
            } else {
                Write-Action "Git needs your name and email. Ask Codex to configure your Git identity."
            }

            $changes = Get-NativeOutput { git status --short }
            if ($changes) {
                Write-Warning "This folder has unpublished changes. Ask Codex to review them before starting unrelated work."
            } else {
                Write-Pass "No unpublished local changes"
            }
        } else {
            Write-Action "This is not the cloned website folder. Clone the repository before running this check."
        }
    }

    if ($nodeReady -and $npmReady -and (Test-Path -LiteralPath (Join-Path $repoRoot "package.json"))) {
        $checkOutput = Get-NativeOutput { npm run check }
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "Website files pass their safety check"
        } else {
            Write-Action "The website safety check failed. Open this folder in Codex and ask it to diagnose: npm run check"
            Write-Host $checkOutput
        }
    }
} finally {
    Pop-Location
}

Write-Host ""
if ($failures -eq 0) {
    Write-Host "READY: This laptop is prepared to edit and publish Rustin's website." -ForegroundColor Green
    if ($warnings -gt 0) {
        Write-Host "Review the note above before making a new change."
    }
    exit 0
}

Write-Host "NOT READY: $failures item(s) need attention." -ForegroundColor Yellow
Write-Host "Take a screenshot of this window or open the folder in Codex and say:"
Write-Host '"Run CHECK_SETUP.cmd and help me fix every ACTION item."' -ForegroundColor White
exit 1

