/**
 * Model Types
 *
 * Core type definitions for model configuration management.
 */

import { AgentType } from "../agent-framework/session-repository.js";

/**
 * Simple model reference
 */
export interface Model {
  provider: string;
  modelId: string;
}

/**
 * Provider authentication configuration
 */
export interface ProviderAuth {
  /** Required URL for the provider endpoint */
  url: string;
  /** Optional API key - not all providers require authentication */
  apiKey?: string;
}

/**
 * Provider configuration
 */
export interface Provider {
  name: string;
  auth: ProviderAuth;
}

/**
 * Models.json file structure
 */
export interface ModelsJson {
  models: Model[];
  agentModels: Partial<Record<AgentType, Model>>;
}

/**
 * Providers.json file structure
 */
export interface ProvidersJson {
  providers: Provider[];
}

/**
 * Options for creating a ModelRepository
 */
export interface ModelRepositoryOptions {
  /** Path to models.json file */
  modelsJsonPath?: string;
}
