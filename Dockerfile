FROM node:22-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Build the frontend assets
RUN npm run build

# Cloud Run injects PORT environment variable. AI Studio Preview expects 3000.
EXPOSE 3000

# Start the server using the configured start script
CMD ["npm", "start"]
