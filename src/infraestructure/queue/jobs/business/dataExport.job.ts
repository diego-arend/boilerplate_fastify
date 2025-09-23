import type { FastifyBaseLogger } from 'fastify';
import type { DataExportJobData, JobResult } from '../../queue.types.js';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

/**
 * Handler for DATA_EXPORT jobs
 * Processes large data export operations in various formats (CSV, JSON, XLSX)
 *
 * @param data - Data export job data containing format, filters, output path, etc.
 * @param jobId - Unique identifier for the job
 * @param logger - Logger instance with job context
 * @returns Promise<JobResult> - Success/failure result with export details
 */
export async function handleDataExport(
  data: DataExportJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<JobResult> {
  const startTime = Date.now();

  logger.info({
    userId: data.userId,
    format: data.format,
    outputPath: data.outputPath,
    hasFilters: !!data.filters && Object.keys(data.filters).length > 0
  }, 'Processing data export job');

  try {
    // Validate export data
    validateExportData(data);

    // Generate output path if not provided
    const outputPath = data.outputPath || generateOutputPath(data.format, jobId);

    logger.debug({ outputPath }, 'Using output path for export');

    // Ensure output directory exists
    await ensureDirectoryExists(outputPath);

    // Simulate data retrieval based on filters
    const exportStats = await retrieveExportData(data, logger);

    // Generate export file
    const fileStats = await generateExportFile(data, outputPath, exportStats, logger);

    const processingTime = Date.now() - startTime;

    logger.info({
      userId: data.userId,
      format: data.format,
      recordCount: exportStats.recordCount,
      fileSize: fileStats.fileSize,
      outputPath,
      processingTime
    }, 'Data export completed successfully');

    return {
      success: true,
      data: {
        exportId: `export_${jobId}_${Date.now()}`,
        userId: data.userId,
        format: data.format,
        filePath: outputPath,
        fileName: fileStats.fileName,
        recordCount: exportStats.recordCount,
        fileSize: fileStats.fileSize,
        filters: data.filters,
        completedAt: new Date().toISOString(),
        downloadUrl: generateDownloadUrl(outputPath),
        expiresAt: generateExpiryDate()
      },
      processedAt: Date.now(),
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown export error';

    logger.error({
      error,
      processingTime,
      userId: data.userId,
      format: data.format
    }, 'Failed to process data export');

    return {
      success: false,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime
    };
  }
}

/**
 * Validates data export job data
 */
function validateExportData(data: DataExportJobData): void {
  if (!data.userId || typeof data.userId !== 'string') {
    throw new Error('Valid userId is required for data export');
  }

  if (!data.format || !['csv', 'json', 'xlsx'].includes(data.format)) {
    throw new Error('Invalid export format. Must be: csv, json, or xlsx');
  }

  // Validate output path if provided
  if (data.outputPath) {
    if (typeof data.outputPath !== 'string') {
      throw new Error('Output path must be a string');
    }

    // Security: prevent path traversal attacks
    if (data.outputPath.includes('..') || data.outputPath.includes('~')) {
      throw new Error('Invalid output path: path traversal detected');
    }

    // Ensure path is within allowed export directory
    if (!data.outputPath.startsWith('/tmp/exports/') && !data.outputPath.startsWith('./exports/')) {
      throw new Error('Output path must be within allowed export directory');
    }
  }

  // Validate filters if provided
  if (data.filters && typeof data.filters !== 'object') {
    throw new Error('Export filters must be an object');
  }

  // Check for potentially dangerous filter values
  if (data.filters) {
    const filterString = JSON.stringify(data.filters);
    const dangerousPatterns = ['<script', 'javascript:', 'eval(', 'function(', 'setTimeout', 'setInterval'];

    for (const pattern of dangerousPatterns) {
      if (filterString.toLowerCase().includes(pattern)) {
        throw new Error(`Potentially malicious content detected in filters: ${pattern}`);
      }
    }
  }
}

/**
 * Generates output file path if not provided
 */
function generateOutputPath(format: string, jobId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `export_${jobId}_${timestamp}.${format}`;
  return `/tmp/exports/${filename}`;
}

/**
 * Ensures the output directory exists
 */
async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = dirname(filePath);

  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create output directory: ${dir}`);
  }
}

/**
 * Simulates data retrieval based on filters
 */
async function retrieveExportData(
  data: DataExportJobData,
  logger: FastifyBaseLogger
): Promise<{
  recordCount: number
  estimatedSize: number
  queryTime: number
}> {
  const queryStart = Date.now();

  logger.debug({
    userId: data.userId,
    filters: data.filters
  }, 'Retrieving data for export');

  // Simulate database query time based on complexity
  const baseQueryTime = 500;
  const filterComplexity = data.filters ? Object.keys(data.filters).length * 100 : 0;
  const queryTime = baseQueryTime + filterComplexity + Math.random() * 1500;

  await new Promise(resolve => setTimeout(resolve, queryTime));

  // Simulate record count based on filters
  const baseRecordCount = 10000;
  const filterReduction = data.filters ? Object.keys(data.filters).length * 0.1 : 0;
  const recordCount = Math.floor(baseRecordCount * (1 - filterReduction) * (0.8 + Math.random() * 0.4));

  // Estimate file size based on format and record count
  const bytesPerRecord = {
    csv: 150,
    json: 300,
    xlsx: 200
  };

  const estimatedSize = recordCount * bytesPerRecord[data.format];
  const actualQueryTime = Date.now() - queryStart;

  logger.debug({
    recordCount,
    estimatedSize,
    queryTime: actualQueryTime
  }, 'Data retrieval completed');

  return {
    recordCount,
    estimatedSize,
    queryTime: actualQueryTime
  };
}

/**
 * Generates the export file
 */
async function generateExportFile(
  data: DataExportJobData,
  outputPath: string,
  exportStats: { recordCount: number },
  logger: FastifyBaseLogger
): Promise<{
  fileName: string
  fileSize: number
  generationTime: number
}> {
  const generationStart = Date.now();

  logger.debug({
    format: data.format,
    outputPath,
    recordCount: exportStats.recordCount
  }, 'Generating export file');

  // Simulate file generation based on format
  const generationTime = await simulateFileGeneration(data.format, exportStats.recordCount);

  // Simulate file creation (in real implementation, this would write actual data)
  const fileName = outputPath.split('/').pop() || `export_${Date.now()}.${data.format}`;
  const fileSize = Math.floor(exportStats.recordCount * getAverageBytesPerRecord(data.format) * (0.9 + Math.random() * 0.2));

  const actualGenerationTime = Date.now() - generationStart;

  logger.debug({
    fileName,
    fileSize,
    generationTime: actualGenerationTime
  }, 'Export file generated');

  return {
    fileName,
    fileSize,
    generationTime: actualGenerationTime
  };
}

/**
 * Simulates file generation time based on format and record count
 */
async function simulateFileGeneration(format: string, recordCount: number): Promise<number> {
  // Different formats have different processing times
  const processingTimePerRecord: Record<string, number> = {
    csv: 0.1,   // Fastest - simple format
    json: 0.2,  // Medium - structured format
    xlsx: 0.5   // Slowest - complex format with styling
  };

  const baseTime = 1000; // Base processing time in ms
  const recordProcessingTime = recordCount * (processingTimePerRecord[format] || 0.2);
  const totalTime = baseTime + recordProcessingTime + Math.random() * 2000;

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, Math.min(totalTime, 10000))); // Cap at 10 seconds

  return totalTime;
}

/**
 * Gets average bytes per record for different formats
 */
function getAverageBytesPerRecord(format: string): number {
  const bytesPerRecord: Record<string, number> = {
    csv: 120,   // Compact text format
    json: 280,  // Structured with metadata
    xlsx: 180   // Compressed binary format
  };

  return bytesPerRecord[format] || 150;
}

/**
 * Generates a download URL for the exported file
 */
function generateDownloadUrl(filePath: string): string {
  const fileName = filePath.split('/').pop();
  const token = Math.random().toString(36).substring(2, 15);
  return `/api/exports/download/${fileName}?token=${token}`;
}

/**
 * Generates expiry date for the export (24 hours from now)
 */
function generateExpiryDate(): string {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24);
  return expiryDate.toISOString();
}
