import type { FastifyInstance } from 'fastify';
import { getDefaultQueueManager } from './queue.manager.js';
import { JobType, JobPriority } from './queue.types.js';
import type { JobData, JobOptions } from './queue.types.js';

export default async function queueController(fastify: FastifyInstance) {
  // Initialize queue manager
  const queueManager = getDefaultQueueManager();
  await queueManager.initialize(fastify.config);

  // Add job to queue
  fastify.post('/queue/jobs', {
    schema: {
      description: 'Add a new job to the queue',
      tags: ['Queue'],
      summary: 'Add Job',
      body: {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: {
            type: 'string',
            enum: Object.values(JobType),
            description: 'Job type'
          },
          data: {
            type: 'object',
            description: 'Job data payload',
            additionalProperties: true
          },
          options: {
            type: 'object',
            properties: {
              priority: {
                type: 'number',
                enum: Object.values(JobPriority),
                description: 'Job priority'
              },
              delay: {
                type: 'number',
                description: 'Delay in milliseconds before processing'
              },
              attempts: {
                type: 'number',
                description: 'Number of retry attempts',
                minimum: 1,
                maximum: 10
              },
              jobId: {
                type: 'string',
                description: 'Custom job ID'
              }
            }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
                type: { type: 'string' },
                queueName: { type: 'string' },
                addedAt: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { type, data, options = {} } = request.body as {
        type: string;
        data: JobData;
        options?: JobOptions;
      };

      // Validate job type
      if (!Object.values(JobType).includes(type as JobType)) {
        return reply.code(400).send({
          success: false,
          error: `Invalid job type. Allowed types: ${Object.values(JobType).join(', ')}`
        });
      }

      // Add timestamp if not present
      if (!data.timestamp) {
        data.timestamp = Date.now();
      }

      // Add user info if authenticated
      if (request.authenticatedUser) {
        data.userId = String(request.authenticatedUser.id);
      }

      const job = await queueManager.addJob(type as JobType, data, options);

      return reply.code(201).send({
        success: true,
        message: 'Job added to queue successfully',
        data: {
          jobId: job.id,
          type: job.name,
          queueName: job.queueName,
          addedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to add job to queue');
      
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add job to queue'
      });
    }
  });

  // Get job status
  fastify.get('/queue/jobs/:jobId', {
    schema: {
      description: 'Get job status and details',
      tags: ['Queue'],
      summary: 'Get Job Status',
      params: {
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: {
            type: 'string',
            description: 'Job ID'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
                type: { type: 'string' },
                status: { type: 'string' },
                data: { type: 'object' },
                result: { type: 'object' },
                createdAt: { type: 'string' },
                processedAt: { type: 'string' },
                finishedAt: { type: 'string' },
                attempts: { type: 'number' },
                failedReason: { type: 'string' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      
      const job = await queueManager.getJob(jobId);
      if (!job) {
        return reply.code(404).send({
          success: false,
          error: 'Job not found'
        });
      }

      const status = await job.getState();
      const result = await queueManager.getJobResult(jobId);

      return reply.send({
        success: true,
        data: {
          jobId: job.id,
          type: job.name,
          status,
          data: job.data,
          result,
          createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
          processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
          finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          attempts: job.attemptsMade,
          failedReason: job.failedReason
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to get job status');
      
      return reply.code(500).send({
        success: false,
        error: 'Failed to get job status'
      });
    }
  });

  // Remove job from queue
  fastify.delete('/queue/jobs/:jobId', {
    schema: {
      description: 'Remove a job from the queue',
      tags: ['Queue'],
      summary: 'Remove Job',
      params: {
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: {
            type: 'string',
            description: 'Job ID'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      
      const removed = await queueManager.removeJob(jobId);
      if (!removed) {
        return reply.code(404).send({
          success: false,
          error: 'Job not found or could not be removed'
        });
      }

      return reply.send({
        success: true,
        message: 'Job removed successfully'
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to remove job');
      
      return reply.code(500).send({
        success: false,
        error: 'Failed to remove job'
      });
    }
  });

  // Get queue statistics
  fastify.get('/queue/stats', {
    schema: {
      description: 'Get queue statistics',
      tags: ['Queue'],
      summary: 'Queue Statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                waiting: { type: 'number' },
                active: { type: 'number' },
                completed: { type: 'number' },
                failed: { type: 'number' },
                delayed: { type: 'number' },
                paused: { type: 'number' },
                total: { type: 'number' },
                timestamp: { type: 'string' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await queueManager.getStats();
      const total = stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed;

      return reply.send({
        success: true,
        data: {
          ...stats,
          total,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to get queue stats');
      
      return reply.code(500).send({
        success: false,
        error: 'Failed to get queue statistics'
      });
    }
  });

  // Pause queue
  fastify.post('/queue/pause', {
    schema: {
      description: 'Pause job processing',
      tags: ['Queue'],
      summary: 'Pause Queue',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await queueManager.pause();
      
      return reply.send({
        success: true,
        message: 'Queue paused successfully'
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to pause queue');
      
      return reply.code(500).send({
        success: false,
        error: 'Failed to pause queue'
      });
    }
  });

  // Resume queue
  fastify.post('/queue/resume', {
    schema: {
      description: 'Resume job processing',
      tags: ['Queue'],
      summary: 'Resume Queue',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await queueManager.resume();
      
      return reply.send({
        success: true,
        message: 'Queue resumed successfully'
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to resume queue');
      
      return reply.code(500).send({
        success: false,
        error: 'Failed to resume queue'
      });
    }
  });

  // Clean completed jobs
  fastify.post('/queue/clean/completed', {
    schema: {
      description: 'Clean completed jobs older than specified time',
      tags: ['Queue'],
      summary: 'Clean Completed Jobs',
      body: {
        type: 'object',
        properties: {
          gracePeriod: {
            type: 'number',
            description: 'Grace period in milliseconds (default: 24 hours)',
            minimum: 1000
          },
          limit: {
            type: 'number',
            description: 'Maximum number of jobs to clean (default: 100)',
            minimum: 1,
            maximum: 1000
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                cleanedJobs: { type: 'number' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { gracePeriod = 24 * 60 * 60 * 1000, limit = 100 } = request.body as {
        gracePeriod?: number;
        limit?: number;
      };

      const cleanedCount = await queueManager.cleanCompleted(gracePeriod, limit);
      
      return reply.send({
        success: true,
        message: `Cleaned ${cleanedCount} completed jobs`,
        data: {
          cleanedJobs: cleanedCount
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to clean completed jobs');
      
      return reply.code(500).send({
        success: false,
        error: 'Failed to clean completed jobs'
      });
    }
  });

  // Clean failed jobs
  fastify.post('/queue/clean/failed', {
    schema: {
      description: 'Clean failed jobs older than specified time',
      tags: ['Queue'],
      summary: 'Clean Failed Jobs',
      body: {
        type: 'object',
        properties: {
          gracePeriod: {
            type: 'number',
            description: 'Grace period in milliseconds (default: 24 hours)',
            minimum: 1000
          },
          limit: {
            type: 'number',
            description: 'Maximum number of jobs to clean (default: 100)',
            minimum: 1,
            maximum: 1000
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                cleanedJobs: { type: 'number' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { gracePeriod = 24 * 60 * 60 * 1000, limit = 100 } = request.body as {
        gracePeriod?: number;
        limit?: number;
      };

      const cleanedCount = await queueManager.cleanFailed(gracePeriod, limit);
      
      return reply.send({
        success: true,
        message: `Cleaned ${cleanedCount} failed jobs`,
        data: {
          cleanedJobs: cleanedCount
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Failed to clean failed jobs');
      
      return reply.code(500).send({
        success: false,
        error: 'Failed to clean failed jobs'
      });
    }
  });
}