/**
 * Evolution API Infrastructure Module
 * Exports all Evolution API related services and utilities
 * Uses native Node.js fetch API (Node.js 18+)
 */

export { EvolutionApiService } from './evolutionApi.service.js';
export { default as evolutionApiPlugin } from './evolution.plugin.js';
export { evolutionConnectionManager } from './connectionManager.js';
export type {
  EvolutionApiConfig,
  SendTextMessageData,
  SendMediaMessageData,
  EvolutionApiResponse
} from './evolutionApi.service.js';
export type { EvolutionConnectionStatus } from './connectionManager.js';
export type { EvolutionApiPluginOptions } from './evolution.plugin.js';
