FROM node:20-slim

WORKDIR /app

# Copy backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend and frontend source
COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /app/backend

ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
