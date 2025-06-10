@REM scripts/setup.bat
@echo off
echo 🚀 Setting up Autonomous Research Development System...

REM Check prerequisites
echo 📋 Checking prerequisites...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop for Windows.
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    exit /b 1
)

REM Check Docker daemon
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker daemon is not running. Please start Docker Desktop.
    exit /b 1
)

REM Check GPU support (optional)
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ GPU support detected
) else (
    echo ⚠️  No GPU support detected. The system will run on CPU slower
)

REM Create necessary directories
echo 📁 Creating directories...
if not exist workspace mkdir workspace
if not exist documents mkdir documents
if not exist logs mkdir logs
if not exist templates mkdir templates
if not exist research_data mkdir research_data
if not exist git_repos mkdir git_repos
if not exist models mkdir models

REM Copy environment file
if not exist .env (
    echo 📝 Creating .env file...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your API keys
)

REM Pull Ollama models
echo 🤖 Pulling Ollama models...
docker pull ollama/ollama:latest

REM Build services
echo 🔨 Building services...
docker-compose build

REM Initialize Ollama with models
echo 🧠 Initializing Ollama models...
docker-compose up -d ollama
timeout /t 10 /nobreak >nul

REM Pull the default model
docker exec research-ollama ollama pull mixtral:8x7b-instruct-v0.1-q4_K_M

REM Install desktop app dependencies
echo 💻 Setting up desktop application...
cd desktop-app
call npm install

REM Build desktop app
call npm run build

cd ..

echo ✅ Setup complete!
echo.
echo To start the system:
echo 1. Run: scripts\start.bat
echo 2. Open the desktop app or visit http://localhost:3000
echo.
echo ⚠️  Don't forget to add your API keys to the .env file!
pause