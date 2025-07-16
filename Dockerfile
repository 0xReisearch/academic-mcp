# Use Node.js 20 LTS
FROM node:20-alpine

LABEL org.opencontainers.image.source https://github.com/0xReisearch/academic-mcp

# Install system dependencies required for PDF processing
RUN apk add --no-cache \
    poppler-utils \
    ghostscript \
    imagemagick \
    graphicsmagick

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Expose port for Express SSE server
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
