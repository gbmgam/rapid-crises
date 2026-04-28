FROM node:22-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
# We use npm ci for a more reliable build in container environments
RUN npm ci

# Copy source
COPY . .

ENV NODE_ENV=production

# Build client-side app
RUN npm run build

# Port 3000 is required by the environment facts
EXPOSE 3000

# Start the server
# Note: Node 22+ supports TypeScript type-stripping via a flag
# If your environment doesn't support it natively, you might need 'npx tsx server.ts'
# but we'll follow the standard node server.ts and let the runtime handle it as per guidelines.
CMD ["node", "server.ts"]
