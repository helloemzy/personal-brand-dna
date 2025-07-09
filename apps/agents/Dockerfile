# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/agents/package*.json ./apps/agents/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/queue/package*.json ./packages/queue/
COPY packages/db/package*.json ./packages/db/

# Install dependencies
RUN npm ci --workspace=@brandpillar/shared
RUN npm ci --workspace=@brandpillar/queue  
RUN npm ci --workspace=@brandpillar/db
RUN npm ci --workspace=@brandpillar/agents

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/queue ./packages/queue
COPY packages/db ./packages/db
COPY apps/agents ./apps/agents

# Build packages
RUN npm run build:shared
RUN npm run build:queue
RUN npm run build:agents

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/agents ./apps/agents

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose health check port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the agents
CMD ["node", "apps/agents/dist/index.js"]