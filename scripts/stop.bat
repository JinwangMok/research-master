@REM scripts/stop.bat
@echo off
echo 🛑 Stopping Autonomous Research Development System...

REM Stop desktop app
echo 💻 Stopping desktop application...
taskkill /F /IM electron.exe >nul 2>nul

REM Stop Docker services
echo 🐳 Stopping Docker services...
docker-compose down

echo ✅ System stopped.
pause