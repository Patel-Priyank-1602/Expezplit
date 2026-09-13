FROM node:20-alpine
WORKDIR /app

# Install shared dependencies so /app/shared has its own node_modules
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install --omit=dev

# Install service dependencies
COPY sse-gateway/ /app/sse-gateway/
WORKDIR /app/sse-gateway
RUN npm install --omit=dev
RUN ln -s /app/sse-gateway/node_modules /app/node_modules

ENV NODE_ENV=production
EXPOSE 4001

CMD ["node", "server.js"]
