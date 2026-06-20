FROM node:20-alpine

# Install build dependencies for sqlite3 compilation if needed
RUN apk add --no-cache make gcc g++ python3

WORKDIR /app

# Copy shared models and types
COPY shared ./shared

# Copy edge-api code
COPY edge-api/package*.json ./edge-api/
WORKDIR /app/edge-api
RUN npm ci

COPY edge-api/ ./
RUN npm run build

EXPOSE 5001

ENV PORT=5001
ENV NODE_ENV=production

CMD ["npm", "start"]
