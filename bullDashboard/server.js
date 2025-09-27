const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const Queue = require('bull');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/ui');

const jobsQueue = new Queue('jobs', {
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: 6379
  },
  prefix: 'bull' // ⚠️ Este prefixo deve coincidir com o usado pela sua aplicação (ex.: n8n)
});

const { addQueue } = createBullBoard({
  queues: [new BullAdapter(jobsQueue)],
  serverAdapter
});

const app = express();
app.use('/ui', serverAdapter.getRouter());

app.listen(3002, () => {
  console.log('Bull Board running on http://localhost:3002/ui');
});
