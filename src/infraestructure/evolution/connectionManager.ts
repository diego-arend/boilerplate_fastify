/**
 * Evolution API Connection Manager
 * Manages connection state and health checks for Evolution API service
 */

import { defaultLogger } from '../../lib/logger/index.js';
import { config } from '../../lib/validators/validateEnv.js';

export interface EvolutionConnectionStatus {
  connected: boolean;
  status?: string | undefined;
  lastCheck?: Date | undefined;
  error?: string | undefined;
}

export class EvolutionConnectionManager {
  private logger = defaultLogger.child({ context: 'evolution-connection-manager' });
  private connectionStatus: EvolutionConnectionStatus = {
    connected: false
  };
  private checkInterval: NodeJS.Timeout | undefined;
  private readonly checkIntervalMs = 30000; // 30 seconds

  constructor() {
    this.logger.info('Evolution Connection Manager initialized');
  }

  /**
   * Start connection monitoring
   */
  async start(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Evolution API not configured, skipping connection manager');
      return;
    }

    this.logger.info('Starting Evolution API connection monitoring');

    // Initial connection check
    await this.checkConnection();

    // Start periodic health checks
    this.checkInterval = setInterval(async () => {
      await this.checkConnection();
    }, this.checkIntervalMs);
  }

  /**
   * Stop connection monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      this.logger.info('Evolution API connection monitoring stopped');
    }
  }

  /**
   * Check if Evolution API is configured
   */
  private isConfigured(): boolean {
    return !!(config.EVOLUTION_API_URL && config.EVOLUTION_API_KEY && config.EVOLUTION_INSTANCE);
  }

  /**
   * Perform connection check
   */
  async checkConnection(): Promise<EvolutionConnectionStatus> {
    if (!this.isConfigured()) {
      this.connectionStatus = {
        connected: false,
        status: 'not-configured',
        lastCheck: new Date(),
        error: 'Evolution API configuration missing'
      };
      return this.connectionStatus;
    }

    const url = `${config.EVOLUTION_API_URL}/instance/connect/${config.EVOLUTION_INSTANCE}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: config.EVOLUTION_API_KEY!
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        this.connectionStatus = {
          connected: false,
          status: `HTTP ${response.status}`,
          lastCheck: new Date(),
          error: `HTTP ${response.status}: ${response.statusText}`
        };

        this.logger.warn(
          {
            status: response.status,
            statusText: response.statusText,
            url: config.EVOLUTION_API_URL
          },
          'Evolution API connection check failed'
        );

        return this.connectionStatus;
      }

      const result = await response.json();
      const instanceState = result.instance?.state || 'connected';

      this.connectionStatus = {
        connected: true,
        status: instanceState,
        lastCheck: new Date()
      };

      // Only log success on state changes to avoid spam
      if (this.connectionStatus.connected !== true) {
        this.logger.info(
          {
            status: instanceState,
            instance: config.EVOLUTION_INSTANCE
          },
          'Evolution API connection established'
        );
      }

      return this.connectionStatus;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.connectionStatus = {
        connected: false,
        status: 'error',
        lastCheck: new Date(),
        error: errorMessage
      };

      this.logger.error(
        {
          error: errorMessage,
          url: config.EVOLUTION_API_URL
        },
        'Evolution API connection check failed'
      );

      return this.connectionStatus;
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): EvolutionConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Check if Evolution API is currently connected
   */
  isConnected(): boolean {
    return this.connectionStatus.connected;
  }

  /**
   * Force a connection check
   */
  async forceCheck(): Promise<EvolutionConnectionStatus> {
    return await this.checkConnection();
  }

  /**
   * Wait for connection to be established
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns Promise that resolves when connected or rejects on timeout
   */
  async waitForConnection(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      await this.checkConnection();

      if (this.isConnected()) {
        return;
      }

      // Wait 1 second before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Evolution API connection timeout after ${timeoutMs}ms`);
  }
}

/**
 * Global Evolution connection manager instance
 */
export const evolutionConnectionManager = new EvolutionConnectionManager();
