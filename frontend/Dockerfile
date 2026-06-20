FROM node:20-alpine

WORKDIR /app

# Copy shared models and types
COPY shared ./shared

# Copy frontend code
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

COPY frontend/ ./

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
