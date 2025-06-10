# scripts/test.sh
#!/bin/bash

echo "🧪 Running tests..."

# Run unit tests
echo "📋 Running unit tests..."
cd mcp-server && npm test && cd ..
cd code-developer && npm test && cd ..

# Run Python tests
echo "🐍 Running Python tests..."
cd research-crawler && python -m pytest tests/ && cd ..
cd doc-generator && python -m pytest tests/ && cd ..

# Run integration tests if services are running
if curl -f http://localhost:3000/health &> /dev/null; then
    echo "🔗 Running integration tests..."
    python -m pytest tests/integration/
else
    echo "⚠️  Services not running, skipping integration tests"
fi

echo "✅ All tests completed!"