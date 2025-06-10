# scripts/stop.sh
#!/bin/bash

echo "🛑 Stopping Autonomous Research & Development System..."

# Stop desktop app
echo "💻 Stopping desktop application..."
pkill -f "electron"

# Stop Docker services
echo "🐳 Stopping Docker services..."
docker-compose down

echo "✅ System stopped."