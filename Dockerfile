FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDeps needed for build step)
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client and build the Remix app
RUN npx prisma generate && npm run build

# Remove devDependencies after build to slim the image
RUN npm prune --omit=dev

# Remove Shopify CLI (not needed in production)
RUN npm remove @shopify/cli 2>/dev/null || true

# Start the custom Express server
# - Binds to 0.0.0.0:PORT immediately
# - Runs DB migrations after bind (so healthcheck passes right away)
CMD ["node", "server.js"]
