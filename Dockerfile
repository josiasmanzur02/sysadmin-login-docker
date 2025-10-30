# 1. Use an official Node.js base image
FROM node:18-alpine

# 2. Set working directory inside the container
WORKDIR /app

# 3. Copy package.json and package-lock.json first
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of your application files
COPY . .

# 6. Expose the port your app runs on
EXPOSE 3000
 
# 7. Start the app
CMD ["node", "index.js"] 