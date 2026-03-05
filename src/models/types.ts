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
 * Provider configuration
 */
export interface Provider {
  name: string;
}

/**
 * Models.json file structure
 */
export interface ModelsJson {
  models: Model[];
  agentModels: Partial<Record<AgentType, Model>>;
}

/**
 * Options for creating a ModelRepository
 */
export interface ModelRepositoryOptions {
  /** Path to models.json file */
  modelsJsonPath?: string;
}
