import type { FastifyBaseLogger } from 'fastify'
import type { CacheWarmJobData, JobResult } from '../../queue.types.js'

/**
 * Handler for CACHE_WARM jobs
 * Processes cache warming operations to preload data and improve performance
 * 
 * @param data - Cache warming job data containing cache key, data source, TTL, etc.
 * @param jobId - Unique identifier for the job
 * @param logger - Logger instance with job context
 * @returns Promise<JobResult> - Success/failure result with cache warming details
 */
export async function handleCacheWarm(
  data: CacheWarmJobData,
  jobId: string,
  logger: FastifyBaseLogger
): Promise<JobResult> {
  const startTime = Date.now()

  logger.info({
    cacheKey: data.cacheKey,
    dataSource: data.dataSource,
    ttl: data.ttl || 3600,
    hasMetadata: !!data.metadata && Object.keys(data.metadata).length > 0
  }, 'Processing cache warm job')

  try {
    // Validate cache warming data
    validateCacheWarmData(data)

    // Check if cache already exists and is fresh
    const existingCacheInfo = await checkExistingCache(data.cacheKey, logger)

    let warmingResult: CacheWarmingResult

    if (existingCacheInfo.exists && existingCacheInfo.isFresh) {
      logger.debug({
        cacheKey: data.cacheKey,
        remainingTTL: existingCacheInfo.remainingTTL
      }, 'Cache is fresh, skipping warming')

      warmingResult = {
        action: 'skipped',
        reason: 'Cache is still fresh',
        dataSize: existingCacheInfo.dataSize,
        remainingTTL: existingCacheInfo.remainingTTL
      }
    } else {
      // Warm the cache with fresh data
      warmingResult = await warmCache(data, logger)
    }

    const processingTime = Date.now() - startTime

    logger.info({
      cacheKey: data.cacheKey,
      action: warmingResult.action,
      dataSize: warmingResult.dataSize,
      processingTime
    }, 'Cache warming completed')

    return {
      success: true,
      data: {
        cacheKey: data.cacheKey,
        dataSource: data.dataSource,
        action: warmingResult.action,
        dataSize: warmingResult.dataSize,
        ttl: data.ttl || 3600,
        warmedAt: new Date().toISOString(),
        expiresAt: calculateExpiryTime(data.ttl),
        metadata: {
          ...warmingResult.metadata,
          jobId,
          processingTime
        }
      },
      processedAt: Date.now(),
      processingTime
    }

  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown cache warming error'

    logger.error({
      error,
      processingTime,
      cacheKey: data.cacheKey,
      dataSource: data.dataSource
    }, 'Failed to warm cache')

    return {
      success: false,
      error: errorMessage,
      processedAt: Date.now(),
      processingTime
    }
  }
}

/**
 * Interface for cache warming result
 */
interface CacheWarmingResult {
  action: 'warmed' | 'refreshed' | 'skipped'
  reason?: string
  dataSize: number
  remainingTTL?: number
  metadata?: Record<string, any>
}

/**
 * Interface for existing cache information
 */
interface ExistingCacheInfo {
  exists: boolean
  isFresh: boolean
  dataSize: number
  remainingTTL: number
  lastWarmed?: string
}

/**
 * Validates cache warming job data
 */
function validateCacheWarmData(data: CacheWarmJobData): void {
  if (!data.cacheKey || typeof data.cacheKey !== 'string') {
    throw new Error('Valid cache key is required')
  }

  if (!data.dataSource || typeof data.dataSource !== 'string') {
    throw new Error('Valid data source is required')
  }

  // Validate cache key format (prevent injection attacks)
  if (!/^[a-zA-Z0-9:_-]+$/.test(data.cacheKey)) {
    throw new Error('Cache key contains invalid characters. Use only alphanumeric, colon, underscore, and dash')
  }

  // Validate cache key length
  if (data.cacheKey.length > 200) {
    throw new Error('Cache key too long (max 200 characters)')
  }

  // Validate TTL if provided
  if (data.ttl !== undefined) {
    if (typeof data.ttl !== 'number' || data.ttl <= 0) {
      throw new Error('TTL must be a positive number')
    }

    if (data.ttl > 86400 * 7) { // 7 days max
      throw new Error('TTL cannot exceed 7 days (604800 seconds)')
    }
  }

  // Validate data source format
  const validDataSources = ['database', 'api', 'file', 'computation', 'external']
  const dataSourceType = data.dataSource.split(':')[0] || 'unknown'
  
  if (!validDataSources.includes(dataSourceType)) {
    throw new Error(`Invalid data source type: ${dataSourceType}. Valid types: ${validDataSources.join(', ')}`)
  }

  // Security validation for data source
  const dangerousPatterns = ['<script', 'javascript:', 'eval(', '../', '..\\', 'file://', 'ftp://']
  
  for (const pattern of dangerousPatterns) {
    if (data.dataSource.toLowerCase().includes(pattern)) {
      throw new Error(`Potentially malicious content detected in data source: ${pattern}`)
    }
  }
}

/**
 * Checks if cache already exists and is fresh
 */
async function checkExistingCache(
  cacheKey: string,
  logger: FastifyBaseLogger
): Promise<ExistingCacheInfo> {
  logger.debug({ cacheKey }, 'Checking existing cache')

  try {
    // Simulate cache lookup with random results
    const cacheExists = Math.random() > 0.3 // 70% chance cache exists
    
    if (!cacheExists) {
      return {
        exists: false,
        isFresh: false,
        dataSize: 0,
        remainingTTL: 0
      }
    }

    // Simulate cache age check
    const remainingTTL = Math.floor(Math.random() * 3600) // 0-3600 seconds remaining
    const isFresh = remainingTTL > 300 // Consider fresh if more than 5 minutes left
    const dataSize = 1024 + Math.floor(Math.random() * 10240) // 1KB-11KB
    const lastWarmed = new Date(Date.now() - (3600 - remainingTTL) * 1000).toISOString()

    logger.debug({
      cacheKey,
      exists: true,
      isFresh,
      remainingTTL,
      dataSize
    }, 'Existing cache information retrieved')

    return {
      exists: true,
      isFresh,
      dataSize,
      remainingTTL,
      lastWarmed
    }

  } catch (error) {
    logger.warn({
      error,
      cacheKey
    }, 'Failed to check existing cache, treating as non-existent')

    return {
      exists: false,
      isFresh: false,
      dataSize: 0,
      remainingTTL: 0
    }
  }
}

/**
 * Warms cache with fresh data from the specified source
 */
async function warmCache(
  data: CacheWarmJobData,
  logger: FastifyBaseLogger
): Promise<CacheWarmingResult> {
  const warmStart = Date.now()
  
  logger.debug({
    cacheKey: data.cacheKey,
    dataSource: data.dataSource
  }, 'Starting cache warming process')

  try {
    // Fetch data based on data source type
    const sourceData = await fetchDataFromSource(data.dataSource, logger)
    
    // Process and validate the data
    const processedData = await processSourceData(sourceData, data, logger)
    
    // Store in cache with TTL
    const storeResult = await storeCacheData(data.cacheKey, processedData, data.ttl, logger)
    
    const warmingTime = Date.now() - warmStart

    logger.debug({
      cacheKey: data.cacheKey,
      dataSize: storeResult.dataSize,
      warmingTime
    }, 'Cache warming completed successfully')

    return {
      action: storeResult.isUpdate ? 'refreshed' : 'warmed',
      dataSize: storeResult.dataSize,
      metadata: {
        fetchTime: sourceData.fetchTime,
        processTime: processedData.processTime,
        storeTime: storeResult.storeTime,
        dataSourceType: data.dataSource.split(':')[0],
        recordCount: processedData.recordCount
      }
    }

  } catch (error) {
    logger.error({
      error,
      cacheKey: data.cacheKey,
      dataSource: data.dataSource
    }, 'Failed to warm cache')
    throw error
  }
}

/**
 * Fetches data from the specified source
 */
async function fetchDataFromSource(
  dataSource: string,
  logger: FastifyBaseLogger
): Promise<{
  data: any
  fetchTime: number
  sourceType: string
}> {
  const fetchStart = Date.now()
  const [sourceType, sourcePath] = dataSource.split(':', 2)
  
  if (!sourceType) {
    throw new Error('Invalid data source format')
  }
  
  logger.debug({ sourceType, sourcePath: sourcePath || '' }, 'Fetching data from source')

  // Simulate different fetch times based on source type
  const fetchTimes = {
    database: () => 200 + Math.random() * 800,     // 200-1000ms
    api: () => 500 + Math.random() * 2000,         // 500-2500ms
    file: () => 100 + Math.random() * 300,         // 100-400ms
    computation: () => 1000 + Math.random() * 5000, // 1-6 seconds
    external: () => 1000 + Math.random() * 3000    // 1-4 seconds
  }

  const fetchTimeCalculator = fetchTimes[sourceType as keyof typeof fetchTimes] || (() => 500)
  const simulatedFetchTime = fetchTimeCalculator()
  
  await new Promise(resolve => setTimeout(resolve, simulatedFetchTime))

  // Simulate different types of data based on source
  const mockData = generateMockDataForSource(sourceType, sourcePath || '')
  
  // Simulate occasional fetch failures
  if (Math.random() < 0.02) { // 2% failure rate
    throw new Error(`Failed to fetch data from ${sourceType}: ${sourcePath || ''}`)
  }

  const fetchTime = Date.now() - fetchStart

  return {
    data: mockData,
    fetchTime,
    sourceType
  }
}

/**
 * Generates mock data based on source type
 */
function generateMockDataForSource(sourceType: string, sourcePath: string): any {
  const baseData = {
    sourceType,
    sourcePath,
    fetchedAt: new Date().toISOString(),
    requestId: Math.random().toString(36).substring(2, 15)
  }

  switch (sourceType) {
    case 'database':
      return {
        ...baseData,
        records: Array.from({ length: 10 + Math.floor(Math.random() * 100) }, (_, i) => ({
          id: i + 1,
          name: `Record ${i + 1}`,
          value: Math.random() * 1000,
          timestamp: new Date().toISOString()
        }))
      }

    case 'api':
      return {
        ...baseData,
        response: {
          status: 'success',
          data: {
            items: Array.from({ length: 5 + Math.floor(Math.random() * 20) }, (_, i) => ({
              id: `item_${i}`,
              score: Math.random() * 100,
              category: `category_${i % 5}`
            }))
          },
          pagination: {
            page: 1,
            total: 25,
            hasNext: false
          }
        }
      }

    case 'file':
      return {
        ...baseData,
        content: `File content from ${sourcePath}`,
        lines: 50 + Math.floor(Math.random() * 200),
        encoding: 'utf-8'
      }

    case 'computation':
      return {
        ...baseData,
        result: {
          computed_value: Math.random() * 10000,
          algorithm: 'simulation',
          iterations: 1000,
          convergence: true
        }
      }

    case 'external':
      return {
        ...baseData,
        external_data: {
          weather: {
            temperature: 15 + Math.random() * 20,
            humidity: 40 + Math.random() * 40,
            condition: 'sunny'
          },
          timestamp: Date.now()
        }
      }

    default:
      return { ...baseData, raw_data: 'generic data payload' }
  }
}

/**
 * Processes and validates source data
 */
async function processSourceData(
  sourceData: { data: any; sourceType: string },
  jobData: CacheWarmJobData,
  logger: FastifyBaseLogger
): Promise<{
  processedData: any
  processTime: number
  recordCount: number
}> {
  const processStart = Date.now()
  
  logger.debug({ sourceType: sourceData.sourceType }, 'Processing source data')

  // Simulate data processing time
  const processingTime = 100 + Math.random() * 500
  await new Promise(resolve => setTimeout(resolve, processingTime))

  // Add cache metadata to the data
  const processedData = {
    ...sourceData.data,
    cacheMetadata: {
      cachedAt: new Date().toISOString(),
      cacheKey: jobData.cacheKey,
      ttl: jobData.ttl || 3600,
      version: 1
    }
  }

  // Count records for different data types
  let recordCount = 1
  if (sourceData.data.records) {
    recordCount = sourceData.data.records.length
  } else if (sourceData.data.response?.data?.items) {
    recordCount = sourceData.data.response.data.items.length
  } else if (sourceData.data.lines) {
    recordCount = sourceData.data.lines
  }

  const processTime = Date.now() - processStart

  return {
    processedData,
    processTime,
    recordCount
  }
}

/**
 * Stores processed data in cache
 */
async function storeCacheData(
  cacheKey: string,
  data: any,
  ttl: number | undefined,
  logger: FastifyBaseLogger
): Promise<{
  dataSize: number
  storeTime: number
  isUpdate: boolean
}> {
  const storeStart = Date.now()
  
  logger.debug({ cacheKey, ttl }, 'Storing data in cache')

  // Simulate cache storage time based on data size
  const dataString = JSON.stringify(data)
  const dataSize = dataString.length
  const storeTime = 50 + (dataSize / 1024) * 10 // Base time + size-based time
  
  await new Promise(resolve => setTimeout(resolve, storeTime))

  // Simulate cache update vs new storage
  const isUpdate = Math.random() > 0.4 // 60% chance it's an update

  // Simulate occasional storage failures
  if (Math.random() < 0.01) { // 1% failure rate
    throw new Error('Cache storage temporarily unavailable')
  }

  const actualStoreTime = Date.now() - storeStart

  logger.debug({
    cacheKey,
    dataSize,
    isUpdate,
    storeTime: actualStoreTime
  }, 'Data stored in cache successfully')

  return {
    dataSize,
    storeTime: actualStoreTime,
    isUpdate
  }
}

/**
 * Calculates cache expiry time
 */
function calculateExpiryTime(ttl?: number): string {
  const expiryTime = new Date()
  expiryTime.setSeconds(expiryTime.getSeconds() + (ttl || 3600))
  return expiryTime.toISOString()
}