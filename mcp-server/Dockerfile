# mcp-server/Dockerfile
FROM node:18-alpine AS mcp-server-build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=mcp-server-build /app/dist ./dist
COPY --from=mcp-server-build /app/node_modules ./node_modules
COPY --from=mcp-server-build /app/package*.json ./

# Create necessary directories
RUN mkdir -p /workspace /logs

# Set user
USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]