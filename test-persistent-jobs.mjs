/**
 * Test script for persistent job processing
 *
 * Tests the complete flow:
 * 1. Create persistent jobs in MongoDB
 * 2. Process them in batches through Redis
 * 3. Handle failures and move to DLQ
 */

import { JobModel } from './src/entities/job/jobEntity.js';
import { DeadLetterQueue } from './src/entities/deadLetterQueue/deadLetterQueueEntity.js';
import { JobBatchRepository } from './src/entities/job/jobBatchRepository.js';

async function testPersistentJobs() {
  console.log('🧪 Testing Persistent Job Processing...');

  try {
    const repository = new JobBatchRepository();

    // Create test jobs
    console.log('📝 Creating test jobs...');

    const testJobs = [
      { type: 'email:send', data: { to: 'test1@example.com', subject: 'Test 1' } },
      { type: 'email:send', data: { to: 'test2@example.com', subject: 'Test 2' } },
      { type: 'user:notification', data: { userId: '123', message: 'Hello' } },
      { type: 'data:export', data: { format: 'csv', userId: '456' } }
    ];

    const createdJobs = [];
    for (const jobData of testJobs) {
      const job = await repository.createJob({
        jobId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ...jobData,
        priority: Math.floor(Math.random() * 10) + 1
      });
      createdJobs.push(job);
      console.log(`✅ Created job: ${job.jobId} (${job.type})`);
    }

    // Load next batch
    console.log('🔄 Loading job batch...');
    const batch = await repository.loadNextBatch(10);

    if (batch) {
      console.log(`✅ Loaded batch: ${batch.batchId} with ${batch.jobs.length} jobs`);

      // Simulate processing
      for (const job of batch.jobs) {
        console.log(`⚙️  Processing job: ${job.jobId}`);

        await repository.markJobAsProcessing(job.jobId, `redis-${Date.now()}`);

        // Simulate success or failure
        if (Math.random() > 0.3) {
          // 70% success rate
          await repository.markJobAsCompleted(job.jobId);
          console.log(`✅ Job completed: ${job.jobId}`);
        } else {
          await repository.markJobAsFailed(
            job.jobId,
            'Simulated processing error',
            'Error stack trace here...'
          );
          console.log(`❌ Job failed: ${job.jobId}`);
        }
      }
    } else {
      console.log('ℹ️  No jobs ready for processing');
    }

    // Show statistics
    console.log('📊 Getting statistics...');
    const stats = await repository.getBatchStats();
    console.log('Job Stats:', stats);

    const readyCount = await repository.getReadyJobsCount();
    console.log(`Ready jobs: ${readyCount}`);

    // Check DLQ entries
    const dlqCount = await DeadLetterQueue.countDocuments();
    console.log(`Dead Letter Queue entries: ${dlqCount}`);

    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPersistentJobs()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { testPersistentJobs };
