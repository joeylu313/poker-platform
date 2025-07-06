FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY client/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY client/ .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"] 