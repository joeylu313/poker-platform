FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY server/ .

# Expose port
EXPOSE 5001

# Start development server
CMD ["npm", "run", "dev"] 