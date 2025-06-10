@REM scripts/start.bat
@echo off
echo Starting Autonomous Research Development System...

REM Check if .env exists
if not exist .env (
    echo ❌ .env file not found. Run scripts\setup.bat first.
    exit /b 1
)

REM Start Docker services
echo 🐳 Starting Docker services...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check service health
echo 🔍 Checking services...
curl -f http://localhost:3000/health >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ MCP Server is running on port 3000
) else (
    echo ❌ MCP Server failed to start
)

curl -f http://localhost:5000/health >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Research Crawler is running on port 5000
) else (
    echo ❌ Research Crawler failed to start
)

curl -f http://localhost:8080/health >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Code Developer is running on port 8080
) else (
    echo ❌ Code Developer failed to start
)

curl -f http://localhost:5001/health >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Document Generator is running on port 5001
) else (
    echo ❌ Document Generator failed to start
)

REM Start desktop app
echo 💻 Starting desktop application...
cd desktop-app
start cmd /c "npm run dev"
cd ..

echo.
echo ✅ System is running!
echo.
echo Services:
echo - MCP Server: http://localhost:3000
echo - Research Crawler: http://localhost:5000
echo - Code Developer: http://localhost:8080
echo - Document Generator: http://localhost:5001
echo - Redis: localhost:6379
echo - Ollama: http://localhost:11434
echo.
echo To stop the system, run: scripts\stop.bat
pause