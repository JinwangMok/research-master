@REM scripts/reset.bat
@echo off
echo 🔄 Resetting Autonomous Research Development System...

set /p confirm=⚠️  This will delete all data. Are you sure? (y/N): 
if /i not "%confirm%"=="y" (
    echo Cancelled.
    exit /b 0
)

REM Stop services
call scripts\stop.bat

REM Remove volumes
echo 🗑️  Removing Docker volumes...
docker-compose down -v

REM Clean workspace
echo 🧹 Cleaning workspace...
if exist workspace\* del /q workspace\*
if exist documents\* del /q documents\*
if exist logs\* del /q logs\*
if exist research_data\* del /q research_data\*
if exist git_repos\* del /q git_repos\*

REM Clean node_modules (optional)
set /p clean_npm=Remove node_modules? (y/N): 
if /i "%clean_npm%"=="y" (
    for /d %%i in (*) do (
        if exist "%%i\node_modules" (
            echo Removing %%i\node_modules...
            rd /s /q "%%i\node_modules"
        )
    )
)

echo ✅ Reset complete.
pause