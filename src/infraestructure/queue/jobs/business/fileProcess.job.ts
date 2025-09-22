import type { FastifyBaseLogger } from 'fastify'
import type { FileProcessJobData, JobResult } from '../../queue.types.js'
import { stat, access } from 'fs/promises'
import { constants } from 'fs'
import { extname, basename, dirname, join } from 'path'

/**
 * Handler for FILE_PROCESS jobs
 * Processes files with various operations like compression, resizing, conversion, and analysis
 * 
 * @param data - File processing job data containing fileId, path, operation, etc.
 * @param jobId - Unique identifier for the job
 * @param logger - Logger instance with job context
 * @returns Promise<JobResult> - Success/failure result with processing details
 */
export async function handleFileProcess(
  data: FileProcessJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<JobResult> {
  const startTime = Date.now()

  logger.info({
    fileId: data.fileId,
    filePath: data.filePath,
    operation: data.operation,
    hasOptions: !!data.options && Object.keys(data.options).length > 0
  }, 'Processing file operation job')

  try {
    // Validate file processing data
    await validateFileProcessData(data)

    // Get file information
    const fileInfo = await getFileInfo(data.filePath, logger)
    
    logger.debug({
      fileSize: fileInfo.size,
      fileType: fileInfo.type,
      lastModified: fileInfo.lastModified
    }, 'File information retrieved')

    // Process file based on operation type
    const processResult = await processFile(data, fileInfo, logger)

    const processingTime = Date.now() - startTime

    logger.info({
      fileId: data.fileId,
      operation: data.operation,
      originalSize: fileInfo.size,
      processedSize: processResult.processedSize,
      compressionRatio: calculateCompressionRatio(fileInfo.size, processResult.processedSize),
      processingTime
    }, 'File processing completed successfully')

    return {
      success: true,
      data: {
        processId: `proc_${jobId}_${Date.now()}`,
        fileId: data.fileId,
        operation: data.operation,
        originalFile: {
          path: data.filePath,
          size: fileInfo.size,
          type: fileInfo.type,
          lastModified: fileInfo.lastModified
        },
        processedFile: {
          path: processResult.outputPath,
          size: processResult.processedSize,
          type: processResult.outputType,
          processingTime: processResult.operationTime
        },
        metadata: processResult.metadata,
        completedAt: new Date().toISOString()
      },
      processedAt: Date.now(),
      processingTime
    }

  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown file processing error'

    logger.error({
      error,
      processingTime,
      fileId: data.fileId,
      filePath: data.filePath,
      operation: data.operation
    }, 'Failed to process file')

    return {
      success: false,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime
    }
  }
}

/**
 * Validates file processing job data
 */
async function validateFileProcessData(data: FileProcessJobData): Promise<void> {
  if (!data.fileId || typeof data.fileId !== 'string') {
    throw new Error('Valid fileId is required for file processing')
  }

  if (!data.filePath || typeof data.filePath !== 'string') {
    throw new Error('Valid file path is required')
  }

  if (!data.operation || !['compress', 'resize', 'convert', 'analyze'].includes(data.operation)) {
    throw new Error('Invalid operation. Must be: compress, resize, convert, or analyze')
  }

  // Security: prevent path traversal attacks
  if (data.filePath.includes('..') || data.filePath.includes('~')) {
    throw new Error('Invalid file path: path traversal detected')
  }

  // Check if file exists and is accessible
  try {
    await access(data.filePath, constants.F_OK | constants.R_OK)
  } catch (error) {
    throw new Error(`File not accessible: ${data.filePath}`)
  }

  // Validate file path is within allowed directories
  const allowedPaths = ['/tmp/uploads/', './uploads/', '/app/files/']
  const isValidPath = allowedPaths.some(allowed => data.filePath.startsWith(allowed))
  
  if (!isValidPath) {
    throw new Error('File path must be within allowed directories')
  }

  // Validate options if provided
  if (data.options && typeof data.options !== 'object') {
    throw new Error('File processing options must be an object')
  }

  // Operation-specific validations
  await validateOperationSpecificData(data)
}

/**
 * Validates operation-specific data and options
 */
async function validateOperationSpecificData(data: FileProcessJobData): Promise<void> {
  const fileExt = extname(data.filePath).toLowerCase()
  
  switch (data.operation) {
    case 'resize':
      // Only allow image files for resize operation
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
      if (!imageExtensions.includes(fileExt)) {
        throw new Error(`Resize operation not supported for file type: ${fileExt}`)
      }
      
      if (data.options?.width && (typeof data.options.width !== 'number' || data.options.width <= 0)) {
        throw new Error('Width must be a positive number')
      }
      
      if (data.options?.height && (typeof data.options.height !== 'number' || data.options.height <= 0)) {
        throw new Error('Height must be a positive number')
      }
      break

    case 'compress':
      // Check file size - don't compress tiny files
      const stats = await stat(data.filePath)
      if (stats.size < 1024) { // Less than 1KB
        throw new Error('File too small to compress effectively')
      }
      break

    case 'convert':
      if (!data.options?.targetFormat) {
        throw new Error('Target format is required for conversion')
      }
      
      const supportedFormats = ['jpg', 'png', 'webp', 'pdf', 'gif']
      if (!supportedFormats.includes(data.options.targetFormat)) {
        throw new Error(`Unsupported target format: ${data.options.targetFormat}`)
      }
      break

    case 'analyze':
      // No specific validation needed for analyze operation
      break
  }
}

/**
 * Gets file information
 */
async function getFileInfo(filePath: string, logger: FastifyBaseLogger): Promise<{
  size: number
  type: string
  lastModified: string
  extension: string
  baseName: string
}> {
  try {
    const stats = await stat(filePath)
    const extension = extname(filePath).toLowerCase()
    const baseName = basename(filePath, extension)
    
    // Determine file type based on extension
    const type = getFileType(extension)
    
    return {
      size: stats.size,
      type,
      lastModified: stats.mtime.toISOString(),
      extension,
      baseName
    }
  } catch (error) {
    logger.error({ error, filePath }, 'Failed to get file information')
    throw new Error(`Cannot access file information: ${filePath}`)
  }
}

/**
 * Determines file type based on extension
 */
function getFileType(extension: string): string {
  const typeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg'
  }
  
  return typeMap[extension] || 'application/octet-stream'
}

/**
 * Processes file based on operation type
 */
async function processFile(
  data: FileProcessJobData,
  fileInfo: { size: number; type: string; extension: string; baseName: string },
  logger: FastifyBaseLogger
): Promise<{
  outputPath: string
  processedSize: number
  outputType: string
  operationTime: number
  metadata: Record<string, any>
}> {
  const operationStart = Date.now()
  
  logger.debug({ 
    operation: data.operation,
    fileSize: fileInfo.size,
    fileType: fileInfo.type
  }, `Starting ${data.operation} operation`)

  let result: {
    outputPath: string
    processedSize: number
    outputType: string
    metadata: Record<string, any>
  }

  switch (data.operation) {
    case 'compress':
      result = await simulateCompress(data, fileInfo, logger)
      break
    case 'resize':
      result = await simulateResize(data, fileInfo, logger)
      break
    case 'convert':
      result = await simulateConvert(data, fileInfo, logger)
      break
    case 'analyze':
      result = await simulateAnalyze(data, fileInfo, logger)
      break
    default:
      throw new Error(`Unsupported operation: ${data.operation}`)
  }

  const operationTime = Date.now() - operationStart

  return {
    ...result,
    operationTime
  }
}

/**
 * Simulates file compression
 */
async function simulateCompress(
  data: FileProcessJobData,
  fileInfo: { size: number; extension: string; baseName: string },
  logger: FastifyBaseLogger
): Promise<{
  outputPath: string
  processedSize: number
  outputType: string
  metadata: Record<string, any>
}> {
  // Simulate compression time based on file size
  const processingTime = Math.min(2000 + (fileInfo.size / 1024) * 10, 10000)
  await new Promise(resolve => setTimeout(resolve, processingTime))

  // Simulate compression ratio (typically 20-70% size reduction)
  const compressionRatio = 0.3 + Math.random() * 0.4 // 30-70% of original size
  const processedSize = Math.floor(fileInfo.size * compressionRatio)
  
  const outputPath = `${dirname(data.filePath)}/${fileInfo.baseName}_compressed${fileInfo.extension}`

  logger.debug({
    originalSize: fileInfo.size,
    compressedSize: processedSize,
    compressionRatio: Math.round((1 - compressionRatio) * 100)
  }, 'Compression completed')

  return {
    outputPath,
    processedSize,
    outputType: getFileType(fileInfo.extension),
    metadata: {
      originalSize: fileInfo.size,
      compressionRatio: Math.round((1 - compressionRatio) * 100),
      algorithm: 'lz4',
      quality: data.options?.quality || 85
    }
  }
}

/**
 * Simulates image resizing
 */
async function simulateResize(
  data: FileProcessJobData,
  fileInfo: { size: number; extension: string; baseName: string },
  logger: FastifyBaseLogger
): Promise<{
  outputPath: string
  processedSize: number
  outputType: string
  metadata: Record<string, any>
}> {
  // Simulate resize time based on dimensions and file size
  const processingTime = 1000 + Math.random() * 3000
  await new Promise(resolve => setTimeout(resolve, processingTime))

  // Calculate new dimensions
  const originalWidth = data.options?.originalWidth || 1920
  const originalHeight = data.options?.originalHeight || 1080
  const newWidth = data.options?.width || Math.floor(originalWidth * 0.5)
  const newHeight = data.options?.height || Math.floor(originalHeight * 0.5)

  // Estimate new file size based on dimension ratio
  const dimensionRatio = (newWidth * newHeight) / (originalWidth * originalHeight)
  const processedSize = Math.floor(fileInfo.size * dimensionRatio * (0.8 + Math.random() * 0.4))
  
  const outputPath = `${dirname(data.filePath)}/${fileInfo.baseName}_${newWidth}x${newHeight}${fileInfo.extension}`

  logger.debug({
    originalDimensions: `${originalWidth}x${originalHeight}`,
    newDimensions: `${newWidth}x${newHeight}`,
    sizeChange: processedSize - fileInfo.size
  }, 'Resize completed')

  return {
    outputPath,
    processedSize,
    outputType: getFileType(fileInfo.extension),
    metadata: {
      originalDimensions: { width: originalWidth, height: originalHeight },
      newDimensions: { width: newWidth, height: newHeight },
      resizeRatio: Math.round(dimensionRatio * 100) / 100,
      interpolation: 'bicubic'
    }
  }
}

/**
 * Simulates file format conversion
 */
async function simulateConvert(
  data: FileProcessJobData,
  fileInfo: { size: number; extension: string; baseName: string },
  logger: FastifyBaseLogger
): Promise<{
  outputPath: string
  processedSize: number
  outputType: string
  metadata: Record<string, any>
}> {
  const targetFormat = data.options?.targetFormat
  
  // Simulate conversion time
  const processingTime = 1500 + Math.random() * 4000
  await new Promise(resolve => setTimeout(resolve, processingTime))

  // Estimate size change based on format conversion
  const formatSizeMultipliers: Record<string, number> = {
    jpg: 0.7,   // JPEG compression
    png: 1.2,   // Lossless, often larger
    webp: 0.6,  // Efficient compression
    pdf: 0.9,   // Document format
    gif: 0.8    // Limited colors
  }
  
  const sizeMultiplier = formatSizeMultipliers[targetFormat!] || 1.0
  const processedSize = Math.floor(fileInfo.size * sizeMultiplier * (0.9 + Math.random() * 0.2))
  
  const outputPath = `${dirname(data.filePath)}/${fileInfo.baseName}_converted.${targetFormat}`

  logger.debug({
    fromFormat: fileInfo.extension,
    toFormat: targetFormat,
    sizeChange: processedSize - fileInfo.size
  }, 'Format conversion completed')

  return {
    outputPath,
    processedSize,
    outputType: getFileType(`.${targetFormat}`),
    metadata: {
      sourceFormat: fileInfo.extension,
      targetFormat: targetFormat!,
      conversionQuality: data.options?.quality || 90,
      colorProfile: 'sRGB'
    }
  }
}

/**
 * Simulates file analysis
 */
async function simulateAnalyze(
  data: FileProcessJobData,
  fileInfo: { size: number; extension: string; baseName: string },
  logger: FastifyBaseLogger
): Promise<{
  outputPath: string
  processedSize: number
  outputType: string
  metadata: Record<string, any>
}> {
  // Simulate analysis time
  const processingTime = 500 + Math.random() * 2000
  await new Promise(resolve => setTimeout(resolve, processingTime))

  // Generate analysis report
  const analysisReport = {
    fileSize: fileInfo.size,
    fileType: getFileType(fileInfo.extension),
    characteristics: generateFileCharacteristics(fileInfo),
    security: performSecurityScan(),
    recommendations: generateRecommendations(fileInfo)
  }

  const reportSize = JSON.stringify(analysisReport).length
  const outputPath = `${dirname(data.filePath)}/${fileInfo.baseName}_analysis.json`

  logger.debug({
    analysisPoints: Object.keys(analysisReport.characteristics).length,
    reportSize
  }, 'File analysis completed')

  return {
    outputPath,
    processedSize: reportSize,
    outputType: 'application/json',
    metadata: analysisReport
  }
}

/**
 * Generates file characteristics for analysis
 */
function generateFileCharacteristics(fileInfo: { size: number; extension: string }): Record<string, any> {
  const characteristics: Record<string, any> = {
    sizeCategory: fileInfo.size < 1024 ? 'tiny' : fileInfo.size < 1024 * 1024 ? 'small' : 'large',
    fileFormat: fileInfo.extension,
    estimatedComplexity: Math.floor(Math.random() * 100)
  }

  // Add type-specific characteristics
  if (fileInfo.extension.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    characteristics.estimatedDimensions = {
      width: 800 + Math.floor(Math.random() * 2000),
      height: 600 + Math.floor(Math.random() * 1500)
    }
    characteristics.estimatedColorDepth = Math.random() > 0.5 ? 24 : 8
  }

  return characteristics
}

/**
 * Performs basic security scan simulation
 */
function performSecurityScan(): Record<string, any> {
  return {
    virusScanResult: 'clean',
    malwareSignatures: 0,
    suspiciousPatterns: Math.floor(Math.random() * 3),
    riskLevel: Math.random() > 0.9 ? 'medium' : 'low'
  }
}

/**
 * Generates optimization recommendations
 */
function generateRecommendations(fileInfo: { size: number; extension: string }): string[] {
  const recommendations: string[] = []

  if (fileInfo.size > 10 * 1024 * 1024) { // > 10MB
    recommendations.push('Consider compressing the file to reduce size')
  }

  if (fileInfo.extension.match(/\.(bmp|tiff)$/)) {
    recommendations.push('Convert to a more efficient format like JPEG or PNG')
  }

  if (Math.random() > 0.7) {
    recommendations.push('File appears optimized for current use case')
  }

  return recommendations
}

/**
 * Calculates compression ratio as percentage
 */
function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0
  return Math.round(((originalSize - compressedSize) / originalSize) * 100)
}