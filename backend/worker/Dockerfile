FROM node:20-alpine
WORKDIR /app

# Install shared dependencies so /app/shared has its own node_modules
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install --omit=dev

# Install service dependencies
COPY worker/ /app/worker/
WORKDIR /app/worker
RUN npm install --omit=dev
RUN ln -s /app/worker/node_modules /app/node_modules

ENV NODE_ENV=production
EXPOSE 9100

CMD ["node", "index.js"]
