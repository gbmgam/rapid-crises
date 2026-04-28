FROM node:22-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
# Using npm install instead of ci to handle lockfile updates during build if needed
RUN npm install

# Copy source
COPY . .

ENV NODE_ENV=production

# Build client-side app
RUN npm run build

# Port 3000 is required by the environment facts
EXPOSE 3000

# Start the server using tsx to handle TypeScript files directly
CMD ["npx", "tsx", "server.ts"]
