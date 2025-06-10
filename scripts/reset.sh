# scripts/reset.sh
#!/bin/bash

echo "🔄 Resetting Autonomous Research & Development System..."

read -p "⚠️  This will delete all data. Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Stop services
./scripts/stop.sh

# Remove volumes
echo "🗑️  Removing Docker volumes..."
docker-compose down -v

# Clean workspace
echo "🧹 Cleaning workspace..."
rm -rf workspace/* documents/* logs/* research_data/* git_repos/*

# Clean node_modules (optional)
read -p "Remove node_modules? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf */node_modules
fi

echo "✅ Reset complete."