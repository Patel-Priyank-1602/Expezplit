FROM node:20-alpine
WORKDIR /app

# Install shared dependencies so /app/shared has its own node_modules
COPY shared/ ./shared/
WORKDIR /app/shared
RUN npm install --omit=dev

# Install service dependencies
COPY email-service/ /app/email-service/
WORKDIR /app/email-service
RUN npm install --omit=dev
RUN ln -s /app/email-service/node_modules /app/node_modules

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
