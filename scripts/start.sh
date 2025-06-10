# scripts/start.sh
#!/bin/bash

echo "🚀 Starting Autonomous Research & Development System..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Run ./scripts/setup.sh first."
    exit 1
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
check_service() {
    if curl -f http://localhost:$1/health &> /dev/null; then
        echo "✅ $2 is running on port $1"
    else
        echo "❌ $2 failed to start"
    fi
}

check_service 3000 "MCP Server"
check_service 5000 "Research Crawler"
check_service 8080 "Code Developer"
check_service 5001 "Document Generator"

# Start desktop app
echo "💻 Starting desktop application..."
cd desktop-app
npm run electron-dev &

echo ""
echo "✅ System is running!"
echo ""
echo "Services:"
echo "- MCP Server: http://localhost:3000"
echo "- Research Crawler: http://localhost:5000"
echo "- Code Developer: http://localhost:8080"
echo "- Document Generator: http://localhost:5001"
echo "- Redis: localhost:6379"
echo "- Ollama: http://localhost:11434"
echo ""
echo "To stop the system, run: ./scripts/stop.sh"