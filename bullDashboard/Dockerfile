FROM node:18-alpine
WORKDIR /app
RUN npm install express @bull-board/api @bull-board/ui @bull-board/express bull ioredis
COPY server.js .
EXPOSE 3002
CMD ["node", "server.js"]