/**
 * Dyson Swarm Task Repository
 *
 * Implementation of TaskRepository that uses dyson-swarm for persistent storage.
 */

import { TaskManager } from "dyson-swarm";
import type {
  TaskRepository,
  Task,
  CreateTaskOptions,
  UpdateTaskOptions,
  TaskFilter,
} from "./task-repository.js";

export interface DysonSwarmTaskRepositoryOptions {
  /** Function that returns the working directory path */
  cwdProvider: () => string;
}

/**
 * Task repository implementation using dyson-swarm
 */
export class DysonSwarmTaskRepository implements TaskRepository {
  private taskManager: TaskManager;

  constructor(options: DysonSwarmTaskRepositoryOptions) {
    this.taskManager = new TaskManager({
      cwdProvider: options.cwdProvider,
    });
  }

  async createTask(options: CreateTaskOptions): Promise<Task> {
    return this.taskManager.createTask(options);
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.taskManager.getTask(taskId);
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    return this.taskManager.listTasks(filter);
  }

  async updateTask(taskId: string, options: UpdateTaskOptions): Promise<Task | null> {
    return this.taskManager.updateTask(taskId, options);
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.taskManager.deleteTask(taskId);
  }

  async addTaskDependency(taskId: string, dependencyId: string): Promise<Task | null> {
    return this.taskManager.addTaskDependency(taskId, dependencyId);
  }

  async removeTaskDependency(taskId: string, dependencyId: string): Promise<Task | null> {
    return this.taskManager.removeTaskDependency(taskId, dependencyId);
  }

  async getTaskDependencies(taskId: string): Promise<Task[]> {
    return this.taskManager.getTaskDependencies(taskId);
  }

  async getDependentTasks(taskId: string): Promise<Task[]> {
    return this.taskManager.getDependentTasks(taskId);
  }
}

/**
 * Factory function to create a DysonSwarmTaskRepository
 */
export function createDysonSwarmTaskRepository(
  options: DysonSwarmTaskRepositoryOptions
): DysonSwarmTaskRepository {
  return new DysonSwarmTaskRepository(options);
}
