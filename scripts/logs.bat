@REM scripts/logs.bat
@echo off
REM Show logs for a specific service or all services

set SERVICE=%1

if "%SERVICE%"=="" (
    echo 📋 Showing logs for all services...
    docker-compose logs -f
) else (
    echo 📋 Showing logs for %SERVICE%...
    docker-compose logs -f %SERVICE%
)