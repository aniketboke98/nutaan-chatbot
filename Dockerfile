FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install all deps (devDeps needed for Remix build)
RUN npm install && npm cache clean --force

COPY . .

# Generate Prisma client for MongoDB + build Remix
RUN npx prisma generate && npm run build

# Prune devDependencies to slim the image
RUN npm prune --omit=dev
RUN npm remove @shopify/cli 2>/dev/null || true

# Server binds immediately, then syncs MongoDB schema and loads Remix
CMD ["node", "server.js"]
