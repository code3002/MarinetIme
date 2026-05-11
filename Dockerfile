FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (skip postinstall prisma generate — we do it manually)
RUN npm install --ignore-scripts

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY apps/api ./apps/api

# Build in order: shared → web → generate prisma → api
RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/web
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace apps/api

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "apps/api/dist/src/server.js"]
