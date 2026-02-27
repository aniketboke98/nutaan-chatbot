FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

# Copy package files - use npm install (not npm ci) so package-lock.json is optional
COPY package.json package-lock.json* ./

# Install all dependencies (including devDeps needed for build)
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client and build the Remix app
RUN npx prisma generate && npm run build

# Remove devDependencies after build to slim the image
RUN npm prune --omit=dev

# Remove Shopify CLI (not needed in production)
RUN npm remove @shopify/cli 2>/dev/null || true

CMD ["npm", "run", "railway-start"]
