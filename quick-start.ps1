# quick-start.ps1 - Windows PowerShell Quick Start Script
# Requires execution with administrator privileges

param(
    [switch]$SkipChecks = $false,
    [switch]$SkipBuild = $false,
    [switch]$DevMode = $false
)

$ErrorActionPreference = "Stop"

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║          Autonomous Research & Development System            ║
║                   Quick Start for Windows                    ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# 1. Check for administrator privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Re-running with administrator privileges..." -ForegroundColor Yellow
    Start-Process PowerShell -Verb RunAs "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

# 2. Check required programs
if (-not $SkipChecks) {
    Write-Host "`nChecking required programs..." -ForegroundColor Yellow
    
    $requirements = @(
        @{Name="Docker"; Command="docker --version"; URL="https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"},
        @{Name="Node.js"; Command="node --version"; URL="https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi"},
        @{Name="Git"; Command="git --version"; URL="https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"}
    )
    
    foreach ($req in $requirements) {
        try {
            Invoke-Expression $req.Command | Out-Null
            Write-Host "  $($req.Name) is installed" -ForegroundColor Green
        } catch {
            Write-Host "  $($req.Name) is not installed" -ForegroundColor Red
            $install = Read-Host "    Install automatically? (Y/N)"
            if ($install -eq 'Y') {
                Write-Host "    Downloading..." -ForegroundColor Yellow
                $installer = "$env:TEMP\$($req.Name)-installer.exe"
                Invoke-WebRequest -Uri $req.URL -OutFile $installer
                Start-Process -FilePath $installer -Wait
            } else {
                exit 1
            }
        }
    }
}

# 3. Verify Docker is running
Write-Host "`nChecking Docker status..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "  Docker is running" -ForegroundColor Green
} catch {
    Write-Host "  Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "  Waiting for Docker to start... (30 seconds)" -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Re-check
    try {
        docker info | Out-Null
        Write-Host "  Docker has started" -ForegroundColor Green
    } catch {
        Write-Host "  Unable to start Docker. Please start Docker Desktop manually." -ForegroundColor Red
        exit 1
    }
}

# 4. Confirm project directory
$projectPath = Get-Location
Write-Host "`nProject path: $projectPath" -ForegroundColor Yellow

# 5. Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "`nGenerating environment configuration file..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    } else {
        # Generate default .env
        @"
# Git settings
GIT_USER_NAME=Research Bot
GIT_USER_EMAIL=research.bot@localhost

# Ollama model (for 8GB GPU)
OLLAMA_MODEL=mixtral:8x7b-instruct-v0.1-q4_K_M

# Service ports
MCP_PORT=3001
CRAWLER_PORT=5000
CODE_DEV_PORT=8080
DOC_GEN_PORT=5001

# Other settings
CLIENT_URL=http://localhost:3001
REDIS_HOST=redis
REDIS_PORT=6379
NODE_ENV=development
"@ | Out-File -FilePath ".env" -Encoding UTF8
    }
    Write-Host "  .env file generated" -ForegroundColor Green
}

# 6. Create directories
Write-Host "`nCreating required directories..." -ForegroundColor Yellow
$dirs = @("workspace", "documents", "logs", "templates", "research_data", "git_repos", "models")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created $dir" -ForegroundColor Green
    }
}

# 7. Build Docker images
if (-not $SkipBuild) {
    Write-Host "`nBuilding Docker images..." -ForegroundColor Yellow
    Write-Host "  This process may take 10-20 minutes..." -ForegroundColor Cyan
    
    # Pull base images first
    $baseImages = @("node:18-alpine", "python:3.11-slim", "redis:7-alpine", "ollama/ollama:latest")
    foreach ($image in $baseImages) {
        Write-Host "  Downloading $image..." -ForegroundColor Yellow
        docker pull $image
    }
    
    # Docker Compose build
    docker-compose build --parallel
    Write-Host "  Docker images build complete" -ForegroundColor Green
}

# 8. Install npm dependencies
Write-Host "`nInstalling npm packages..." -ForegroundColor Yellow
$npmDirs = @("mcp-server", "code-developer", "desktop-app")
foreach ($dir in $npmDirs) {
    if (Test-Path "$dir\package.json") {
        Write-Host "  Installing dependencies for $dir..." -ForegroundColor Yellow
        Set-Location $dir
        npm install --silent
        Set-Location ..
    }
}
Write-Host "  npm packages installation complete" -ForegroundColor Green

# 9. Start services
Write-Host "`nStarting services..." -ForegroundColor Yellow
docker-compose up -d

# 10. Check service status (wait 30 seconds)
Write-Host "`nWaiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "`nChecking service status..." -ForegroundColor Yellow
$services = @(
    @{Name="MCP Server"; Port=3001},
    @{Name="Research Crawler"; Port=5000},
    @{Name="Code Developer"; Port=8080},
    @{Name="Document Generator"; Port=5001}
)

$allHealthy = $true
foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)/health" -UseBasicParsing -TimeoutSec 5
        Write-Host "  $($service.Name) is responding" -ForegroundColor Green
    } catch {
        Write-Host "  $($service.Name) is not responding" -ForegroundColor Red
        $allHealthy = $false
    }
}

# 11. Verify Ollama models
Write-Host "`nChecking Ollama models..." -ForegroundColor Yellow
$modelList = docker exec research-ollama ollama list 2>$null
if ($modelList -notmatch "mixtral") {
    Write-Host "  Downloading Mixtral model... (approx. 4GB)" -ForegroundColor Yellow
    docker exec research-ollama ollama pull mixtral:8x7b-instruct-v0.1-q4_K_M
    Write-Host "  Model download complete" -ForegroundColor Green
} else {
    Write-Host "  Ollama model is ready" -ForegroundColor Green
}

# After ensuring the model is available, restart all services so
# containers that depend on Ollama can start successfully.
Write-Host "`nRestarting services..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "`nWaiting for services to become healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "`nRechecking service status..." -ForegroundColor Yellow
foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)/health" -UseBasicParsing -TimeoutSec 5
        Write-Host "  $($service.Name) is responding" -ForegroundColor Green
    } catch {
        Write-Host "  $($service.Name) is not responding" -ForegroundColor Red
        $allHealthy = $false
    }
}

# 12. Start desktop app
if ($DevMode) {
    Write-Host "`nStarting desktop app in development mode..." -ForegroundColor Yellow
    Set-Location desktop-app
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
    Set-Location ..
} else {
    Write-Host "`nTo start the desktop app:" -ForegroundColor Yellow
    Write-Host "  cd desktop-app" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
}

# 14. Option to open browser
$openBrowser = Read-Host "`nOpen browser to check the system? (Y/N)"
if ($openBrowser -eq 'Y') {
    Start-Process "http://localhost:3001"
}

Write-Host "`nScript complete. If there are issues, check the logs folder." -ForegroundColor Cyan
