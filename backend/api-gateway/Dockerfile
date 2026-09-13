FROM node:20-alpine
WORKDIR /app

# Install shared dependencies so /app/shared has its own node_modules
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install --omit=dev

# Install service dependencies
COPY api-gateway/ /app/api-gateway/
WORKDIR /app/api-gateway
RUN npm install --omit=dev
RUN ln -s /app/api-gateway/node_modules /app/node_modules

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "server.js"]
