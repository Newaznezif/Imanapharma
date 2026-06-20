FROM node:20-alpine

WORKDIR /app

# Copy shared models and types
COPY shared ./shared

# Copy cloud-api code
COPY cloud-api/package*.json ./cloud-api/
WORKDIR /app/cloud-api
RUN npm ci

COPY cloud-api/ ./
RUN npm run build

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["npm", "start"]
