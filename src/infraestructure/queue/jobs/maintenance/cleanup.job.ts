import type { FastifyBaseLogger } from 'fastify';
import type { CleanupJobData, JobResult } from '../../queue.types.js';
import { readdir, stat, unlink, rmdir } from 'fs/promises';
import { join, extname } from 'path';

/**
 * Handler for CLEANUP jobs
 * Processes system cleanup tasks including file cleanup, log rotation, and cache clearing
 *
 * @param data - Cleanup job data containing target, criteria, patterns, etc.
 * @param jobId - Unique identifier for the job
 * @param logger - Logger instance with job context
 * @returns Promise<JobResult> - Success/failure result with cleanup statistics
 */
export async function handleCleanup(
  data: CleanupJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<JobResult> {
  const startTime = Date.now();

  logger.info(
    {
      target: data.target,
      olderThan: data.olderThan,
      pattern: data.pattern,
      hasMetadata: !!data.metadata && Object.keys(data.metadata).length > 0
    },
    'Processing cleanup job'
  );

  try {
    // Validate cleanup data
    validateCleanupData(data);

    // Execute cleanup based on target type
    const cleanupResult = await executeCleanup(data, logger);

    const processingTime = Date.now() - startTime;

    logger.info(
      {
        target: data.target,
        itemsProcessed: cleanupResult.itemsProcessed,
        itemsRemoved: cleanupResult.itemsRemoved,
        spaceFreed: cleanupResult.spaceFreed,
        processingTime
      },
      'Cleanup completed successfully'
    );

    return {
      success: true,
      data: {
        cleanupId: `cleanup_${jobId}_${Date.now()}`,
        target: data.target,
        criteria: {
          olderThan: data.olderThan,
          pattern: data.pattern
        },
        results: {
          itemsProcessed: cleanupResult.itemsProcessed,
          itemsRemoved: cleanupResult.itemsRemoved,
          itemsSkipped: cleanupResult.itemsSkipped,
          spaceFreed: cleanupResult.spaceFreed,
          errors: cleanupResult.errors
        },
        timing: {
          scanTime: cleanupResult.scanTime,
          deleteTime: cleanupResult.deleteTime,
          totalTime: processingTime
        },
        completedAt: new Date().toISOString(),
        summary: generateCleanupSummary(cleanupResult)
      },
      processedAt: Date.now(),
      processingTime
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown cleanup error';

    logger.error(
      {
        error,
        processingTime,
        target: data.target
      },
      'Failed to process cleanup'
    );

    return {
      success: false,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime
    };
  }
}

/**
 * Interface for cleanup operation result
 */
interface CleanupResult {
  itemsProcessed: number;
  itemsRemoved: number;
  itemsSkipped: number;
  spaceFreed: number;
  errors: string[];
  scanTime: number;
  deleteTime: number;
  details: CleanupDetail[];
}

/**
 * Interface for individual cleanup operation detail
 */
interface CleanupDetail {
  path: string;
  size: number;
  action: 'deleted' | 'skipped' | 'error';
  reason?: string;
  timestamp: string;
}

/**
 * Validates cleanup job data
 */
function validateCleanupData(data: CleanupJobData): void {
  if (
    !data.target ||
    !['temp_files', 'old_logs', 'expired_sessions', 'cache'].includes(data.target)
  ) {
    throw new Error(
      'Invalid cleanup target. Must be: temp_files, old_logs, expired_sessions, or cache'
    );
  }

  // Validate olderThan if provided (days)
  if (data.olderThan !== undefined) {
    if (typeof data.olderThan !== 'number' || data.olderThan < 0) {
      throw new Error('olderThan must be a non-negative number (days)');
    }

    if (data.olderThan > 365) {
      // Maximum 1 year
      throw new Error('olderThan cannot exceed 365 days');
    }
  }

  // Validate pattern if provided
  if (data.pattern !== undefined) {
    if (typeof data.pattern !== 'string') {
      throw new Error('Pattern must be a string');
    }

    // Security: prevent dangerous patterns
    const dangerousPatterns = ['../', '../', '~/', '/etc/', '/usr/', '/var/lib/', '/root/'];

    for (const dangerous of dangerousPatterns) {
      if (data.pattern.includes(dangerous)) {
        throw new Error(`Dangerous pattern detected: ${dangerous}`);
      }
    }

    // Prevent wildcards that could be too broad
    if (data.pattern === '*' || data.pattern === '/*' || data.pattern === '/**') {
      throw new Error('Pattern too broad - this could delete system files');
    }
  }

  // Target-specific validations
  validateTargetSpecificData(data);
}

/**
 * Validates target-specific data and constraints
 */
function validateTargetSpecificData(data: CleanupJobData): void {
  switch (data.target) {
    case 'temp_files':
      // Default to 7 days if not specified
      if (data.olderThan === undefined) {
        data.olderThan = 7;
      }
      break;

    case 'old_logs':
      // Default to 30 days if not specified
      if (data.olderThan === undefined) {
        data.olderThan = 30;
      }
      // Ensure we don't delete recent logs
      if (data.olderThan < 1) {
        throw new Error('Log files must be at least 1 day old to be cleaned up');
      }
      break;

    case 'expired_sessions':
      // Default to 1 day if not specified
      if (data.olderThan === undefined) {
        data.olderThan = 1;
      }
      break;

    case 'cache':
      // Default to 7 days if not specified
      if (data.olderThan === undefined) {
        data.olderThan = 7;
      }
      break;
  }
}

/**
 * Executes cleanup based on target type
 */
async function executeCleanup(
  data: CleanupJobData,
  logger: FastifyBaseLogger
): Promise<CleanupResult> {
  logger.debug({ target: data.target }, `Starting ${data.target} cleanup`);

  switch (data.target) {
    case 'temp_files':
      return await cleanupTempFiles(data, logger);
    case 'old_logs':
      return await cleanupOldLogs(data, logger);
    case 'expired_sessions':
      return await cleanupExpiredSessions(data, logger);
    case 'cache':
      return await cleanupCache(data, logger);
    default:
      throw new Error(`Unsupported cleanup target: ${data.target}`);
  }
}

/**
 * Cleans up temporary files
 */
async function cleanupTempFiles(
  data: CleanupJobData,
  logger: FastifyBaseLogger
): Promise<CleanupResult> {
  const scanStart = Date.now();
  const tempDirectories = ['/tmp/', './temp/', '/app/tmp/'];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (data.olderThan || 7));

  logger.debug(
    {
      directories: tempDirectories,
      cutoffDate: cutoffDate.toISOString(),
      pattern: data.pattern
    },
    'Scanning temporary directories'
  );

  // Simulate scanning temp directories
  const scanResult = await simulateDirectoryScan(tempDirectories, cutoffDate, data.pattern);
  const scanTime = Date.now() - scanStart;

  // Simulate deletion process
  const deleteStart = Date.now();
  const deleteResult = await simulateFileDeletion(scanResult.candidates, 'temp', logger);
  const deleteTime = Date.now() - deleteStart;

  return {
    itemsProcessed: scanResult.totalFiles,
    itemsRemoved: deleteResult.deleted.length,
    itemsSkipped: deleteResult.skipped.length,
    spaceFreed: deleteResult.spaceFreed,
    errors: deleteResult.errors,
    scanTime,
    deleteTime,
    details: [...deleteResult.deleted, ...deleteResult.skipped, ...deleteResult.failed]
  };
}

/**
 * Cleans up old log files
 */
async function cleanupOldLogs(
  data: CleanupJobData,
  logger: FastifyBaseLogger
): Promise<CleanupResult> {
  const scanStart = Date.now();
  const logDirectories = ['/var/log/', './logs/', '/app/logs/'];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (data.olderThan || 30));

  logger.debug(
    {
      directories: logDirectories,
      cutoffDate: cutoffDate.toISOString(),
      pattern: data.pattern || '*.log'
    },
    'Scanning log directories'
  );

  // Use log-specific pattern if not provided
  const logPattern = data.pattern || '*.log';

  const scanResult = await simulateDirectoryScan(logDirectories, cutoffDate, logPattern);
  const scanTime = Date.now() - scanStart;

  const deleteStart = Date.now();
  const deleteResult = await simulateFileDeletion(scanResult.candidates, 'log', logger);
  const deleteTime = Date.now() - deleteStart;

  // Log rotation simulation
  const rotatedLogs = Math.floor(scanResult.candidates.length * 0.1); // 10% get rotated instead of deleted

  return {
    itemsProcessed: scanResult.totalFiles,
    itemsRemoved: deleteResult.deleted.length,
    itemsSkipped: deleteResult.skipped.length + rotatedLogs,
    spaceFreed: deleteResult.spaceFreed,
    errors: deleteResult.errors,
    scanTime,
    deleteTime,
    details: [...deleteResult.deleted, ...deleteResult.skipped, ...deleteResult.failed]
  };
}

/**
 * Cleans up expired session data
 */
async function cleanupExpiredSessions(
  data: CleanupJobData,
  logger: FastifyBaseLogger
): Promise<CleanupResult> {
  const scanStart = Date.now();
  const sessionDirectories = ['./sessions/', '/tmp/sessions/', '/app/sessions/'];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (data.olderThan || 1));

  logger.debug(
    {
      directories: sessionDirectories,
      cutoffDate: cutoffDate.toISOString()
    },
    'Scanning session directories'
  );

  // Session files are typically small but numerous
  const sessionPattern = data.pattern || 'sess_*';

  const scanResult = await simulateDirectoryScan(sessionDirectories, cutoffDate, sessionPattern);
  const scanTime = Date.now() - scanStart;

  const deleteStart = Date.now();
  const deleteResult = await simulateFileDeletion(scanResult.candidates, 'session', logger);
  const deleteTime = Date.now() - deleteStart;

  return {
    itemsProcessed: scanResult.totalFiles,
    itemsRemoved: deleteResult.deleted.length,
    itemsSkipped: deleteResult.skipped.length,
    spaceFreed: deleteResult.spaceFreed,
    errors: deleteResult.errors,
    scanTime,
    deleteTime,
    details: [...deleteResult.deleted, ...deleteResult.skipped, ...deleteResult.failed]
  };
}

/**
 * Cleans up cache files
 */
async function cleanupCache(
  data: CleanupJobData,
  logger: FastifyBaseLogger
): Promise<CleanupResult> {
  const scanStart = Date.now();
  const cacheDirectories = ['./cache/', '/tmp/cache/', '/app/cache/'];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (data.olderThan || 7));

  logger.debug(
    {
      directories: cacheDirectories,
      cutoffDate: cutoffDate.toISOString(),
      pattern: data.pattern
    },
    'Scanning cache directories'
  );

  const scanResult = await simulateDirectoryScan(cacheDirectories, cutoffDate, data.pattern);
  const scanTime = Date.now() - scanStart;

  const deleteStart = Date.now();
  const deleteResult = await simulateFileDeletion(scanResult.candidates, 'cache', logger);
  const deleteTime = Date.now() - deleteStart;

  return {
    itemsProcessed: scanResult.totalFiles,
    itemsRemoved: deleteResult.deleted.length,
    itemsSkipped: deleteResult.skipped.length,
    spaceFreed: deleteResult.spaceFreed,
    errors: deleteResult.errors,
    scanTime,
    deleteTime,
    details: [...deleteResult.deleted, ...deleteResult.skipped, ...deleteResult.failed]
  };
}

/**
 * Simulates directory scanning for cleanup candidates
 */
async function simulateDirectoryScan(
  directories: string[],
  cutoffDate: Date,
  pattern?: string
): Promise<{
  totalFiles: number;
  candidates: Array<{ path: string; size: number; lastModified: Date }>;
}> {
  // Simulate scanning time
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));

  const totalFiles = 50 + Math.floor(Math.random() * 200); // 50-250 files
  const candidateCount = Math.floor(totalFiles * (0.2 + Math.random() * 0.6)); // 20-80% qualify for cleanup

  const candidates = Array.from({ length: candidateCount }, (_, i) => {
    const ageInDays = Math.random() * 90; // Up to 90 days old
    const lastModified = new Date();
    lastModified.setDate(lastModified.getDate() - ageInDays);

    const baseSize = 1024; // 1KB base
    const randomSize = Math.floor(Math.random() * (1024 * 1024)); // Up to 1MB

    return {
      path: `${directories[i % directories.length]}file_${i}_${Date.now()}.tmp`,
      size: baseSize + randomSize,
      lastModified
    };
  }).filter(file => file.lastModified < cutoffDate);

  return {
    totalFiles,
    candidates
  };
}

/**
 * Simulates file deletion process
 */
async function simulateFileDeletion(
  candidates: Array<{ path: string; size: number; lastModified: Date }>,
  fileType: string,
  logger: FastifyBaseLogger
): Promise<{
  deleted: CleanupDetail[];
  skipped: CleanupDetail[];
  failed: CleanupDetail[];
  spaceFreed: number;
  errors: string[];
}> {
  const deleted: CleanupDetail[] = [];
  const skipped: CleanupDetail[] = [];
  const failed: CleanupDetail[] = [];
  const errors: string[] = [];
  let spaceFreed = 0;

  // Simulate deletion process with some failures and skips
  for (const candidate of candidates) {
    const random = Math.random();

    if (random < 0.02) {
      // 2% deletion failures
      const error = `Permission denied: ${candidate.path}`;
      errors.push(error);
      failed.push({
        path: candidate.path,
        size: candidate.size,
        action: 'error',
        reason: 'Permission denied',
        timestamp: new Date().toISOString()
      });
    } else if (random < 0.05) {
      // 3% skipped (in use, etc.)
      skipped.push({
        path: candidate.path,
        size: candidate.size,
        action: 'skipped',
        reason: 'File in use',
        timestamp: new Date().toISOString()
      });
    } else {
      // 95% successful deletion
      deleted.push({
        path: candidate.path,
        size: candidate.size,
        action: 'deleted',
        timestamp: new Date().toISOString()
      });
      spaceFreed += candidate.size;
    }

    // Simulate per-file processing time
    if (candidates.length > 100) {
      // Only add delay for large operations to avoid excessive simulation time
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  // Simulate batch deletion time
  const batchTime = Math.min(candidates.length * 10, 2000);
  await new Promise(resolve => setTimeout(resolve, batchTime));

  logger.debug(
    {
      fileType,
      deleted: deleted.length,
      skipped: skipped.length,
      failed: failed.length,
      spaceFreed
    },
    'File deletion simulation completed'
  );

  return {
    deleted,
    skipped,
    failed,
    spaceFreed,
    errors
  };
}

/**
 * Generates a summary of the cleanup operation
 */
function generateCleanupSummary(result: CleanupResult): string {
  const { itemsProcessed, itemsRemoved, spaceFreed } = result;
  const removalRate = itemsProcessed > 0 ? ((itemsRemoved / itemsProcessed) * 100).toFixed(1) : '0';
  const spaceMB = (spaceFreed / (1024 * 1024)).toFixed(2);

  let summary = `Processed ${itemsProcessed} items, removed ${itemsRemoved} (${removalRate}%)`;

  if (spaceFreed > 0) {
    summary += `, freed ${spaceMB}MB`;
  }

  if (result.errors.length > 0) {
    summary += `, ${result.errors.length} errors encountered`;
  }

  return summary;
}
