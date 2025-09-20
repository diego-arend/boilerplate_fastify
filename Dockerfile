# Use Node.js 20 LTS Alpine for smaller image size
FROM node:22-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@10.13.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build stage
FROM base AS build

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

# Install pnpm in production
RUN npm install -g pnpm@10.13.1

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S fastify -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod && pnpm cache clean

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Copy environment file if it exists
COPY --chown=fastify:nodejs .env* ./

# Change ownership of the app directory
RUN chown -R fastify:nodejs /app
USER fastify

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/server.js"]