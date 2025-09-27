const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/ui');

// Create BullMQ Queue instance with same configuration as the app
const appQueue = new Queue('app-queue', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: 6379,
    db: 1, // Same DB as used in QueueManager
    maxRetriesPerRequest: null
  }
});

createBullBoard({
  queues: [new BullMQAdapter(appQueue)],
  serverAdapter
});

const app = express();
app.use('/ui', serverAdapter.getRouter());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(3002, () => {
  console.log('Bull Board (BullMQ) running on http://localhost:3002/ui');
  console.log('Health check: http://localhost:3002/health');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down Bull Dashboard...');
  await appQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down Bull Dashboard...');
  await appQueue.close();
  process.exit(0);
});
