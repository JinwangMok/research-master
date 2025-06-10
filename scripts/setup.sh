# scripts/setup.sh
#!/bin/bash

echo "🚀 Setting up Autonomous Research & Development System..."

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install $1 first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command docker
check_command docker-compose
check_command node
check_command npm
check_command git

# Check Docker daemon
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker."
    exit 1
fi

# Check GPU support (optional)
if docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi &> /dev/null; then
    echo "✅ GPU support detected"
else
    echo "⚠️  No GPU support detected. The system will run on CPU (slower)"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p workspace documents logs templates research_data git_repos models

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your API keys"
fi

# Pull Ollama models
echo "🤖 Pulling Ollama models..."
docker pull ollama/ollama:latest

# Build services
echo "🔨 Building services..."
docker-compose build

# Initialize Ollama with models
echo "🧠 Initializing Ollama models..."
docker-compose up -d ollama
sleep 10

# Pull the default model
docker exec research-ollama ollama pull mixtral:8x7b-instruct-v0.1-q4_K_M

# Install desktop app dependencies
echo "💻 Setting up desktop application..."
cd desktop-app
npm install

# Build desktop app
npm run build

echo "✅ Setup complete!"
echo ""
echo "To start the system:"
echo "1. Run: ./scripts/start.sh"
echo "2. Open the desktop app or visit http://localhost:3001"
echo ""
echo "⚠️  Don't forget to add your API keys to the .env file!"