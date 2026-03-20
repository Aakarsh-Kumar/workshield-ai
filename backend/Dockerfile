FROM node:20-alpine

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY package*.json ./
RUN npm install --omit=dev --no-fund --no-audit

# Copy application source
COPY . .

EXPOSE 4000

# Use dumb-init as PID 1 to forward signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "app.js"]
