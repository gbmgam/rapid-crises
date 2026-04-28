FROM node:22-slim

WORKDIR /app

# Install dependencies (including devDependencies for building)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set production environment
ENV NODE_ENV=production

# Build the frontend assets
RUN npm run build

# Cloud Run uses the PORT environment variable (usually 8080)
# AI Studio environment expects 3000.
# The server.ts handles this via process.env.PORT || 3000
EXPOSE 3000

# Start the server
CMD ["npx", "tsx", "server.ts"]
