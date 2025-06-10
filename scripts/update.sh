# scripts/update.sh
#!/bin/bash

echo "🔄 Updating Autonomous Research & Development System..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull

# Rebuild services
echo "🔨 Rebuilding services..."
docker-compose build

# Update dependencies
echo "📦 Updating dependencies..."
cd desktop-app && npm update && cd ..

# Restart services
echo "🔄 Restarting services..."
./scripts/stop.sh
./scripts/start.sh

echo "✅ Update complete!"