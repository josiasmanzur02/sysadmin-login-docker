# 1. Use an official Node.js base image
FROM node:18-alpine

# 2. Set working directory inside the container
WORKDIR /app

# 3. Install build tools required for native modules (e.g., bcrypt)
RUN apk add --no-cache python3 make g++

# 4. Copy package manifests first for better build caching
COPY package*.json ./

# 5. Install production dependencies only
RUN npm ci --omit=dev

# 6. Copy the rest of the source
COPY . .

# 7. Expose the port your app listens on
EXPOSE 3000

# 8. Run the server
CMD ["node", "index.js"]
