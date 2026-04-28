FROM node:22-alpine

# Install build dependencies for potential native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies (including devDeps for build)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Build the client-side app
RUN npm run build

# Default Cloud Run port is 8080
EXPOSE 8080

# Start using tsx
CMD ["npm", "start"]
