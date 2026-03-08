/**
 * Dyson Swarm Task Repository
 *
 * Implementation of TaskRepository that uses dyson-swarm for persistent storage.
 */

import { TaskManager } from "dyson-swarm";
import type {
  Task as DysonTask,
  TaskStatus as DysonTaskStatus,
  CreateTaskOptions as DysonCreateTaskOptions,
  UpdateTaskOptions as DysonUpdateTaskOptions,
  TaskFilter as DysonTaskFilter,
} from "dyson-swarm";
import type {
  TaskRepository,
  Task,
  TaskStatus,
  CreateTaskOptions,
  UpdateTaskOptions,
  TaskFilter,
} from "./task-repository.js";

export interface DysonSwarmTaskRepositoryOptions {
  /** Function that returns the working directory path */
  cwdProvider: () => string;
}

/**
 * Maps a dyson-swarm Task to our Task type
 */
export function mapDysonTaskToTask(dysonTask: DysonTask): Task {
  return {
    id: dysonTask.id,
    frontmatter: {
      title: dysonTask.frontmatter.title,
      assignee: dysonTask.frontmatter.assignee,
      dependsOn: dysonTask.frontmatter.dependsOn,
    },
    description: dysonTask.description,
    status: dysonTask.status as TaskStatus,
  };
}

/**
 * Maps our CreateTaskOptions to dyson-swarm CreateTaskOptions
 */
export function mapCreateOptionsToDyson(options: CreateTaskOptions): DysonCreateTaskOptions {
  return {
    title: options.title,
    description: options.description,
    assignee: options.assignee,
    parentTaskId: options.parentTaskId,
    dependsOn: options.dependsOn,
  };
}

/**
 * Maps our UpdateTaskOptions to dyson-swarm UpdateTaskOptions
 */
export function mapUpdateOptionsToDyson(options: UpdateTaskOptions): DysonUpdateTaskOptions {
  return {
    title: options.title,
    description: options.description,
    assignee: options.assignee,
    dependsOn: options.dependsOn,
  };
}

/**
 * Maps our TaskFilter to dyson-swarm TaskFilter
 */
export function mapFilterToDyson(filter?: TaskFilter): DysonTaskFilter | undefined {
  if (!filter) return undefined;
  return {
    status: filter.status as DysonTaskStatus | undefined,
    taskId: filter.taskId,
    dependsOn: filter.dependsOn,
  };
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
    const dysonOptions = mapCreateOptionsToDyson(options);
    const dysonTask = await this.taskManager.createTask(dysonOptions);
    return mapDysonTaskToTask(dysonTask);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const dysonTask = await this.taskManager.getTask(taskId);
    if (!dysonTask) return null;
    return mapDysonTaskToTask(dysonTask);
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    const dysonFilter = mapFilterToDyson(filter);
    const dysonTasks = await this.taskManager.listTasks(dysonFilter);
    return dysonTasks.map(mapDysonTaskToTask);
  }

  async updateTask(taskId: string, options: UpdateTaskOptions): Promise<Task | null> {
    const dysonOptions = mapUpdateOptionsToDyson(options);
    const dysonTask = await this.taskManager.updateTask(taskId, dysonOptions);
    if (!dysonTask) return null;
    return mapDysonTaskToTask(dysonTask);
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.taskManager.deleteTask(taskId);
  }

  async addTaskDependency(taskId: string, dependencyId: string): Promise<Task | null> {
    const dysonTask = await this.taskManager.addTaskDependency(taskId, dependencyId);
    if (!dysonTask) return null;
    return mapDysonTaskToTask(dysonTask);
  }

  async removeTaskDependency(taskId: string, dependencyId: string): Promise<Task | null> {
    const dysonTask = await this.taskManager.removeTaskDependency(taskId, dependencyId);
    if (!dysonTask) return null;
    return mapDysonTaskToTask(dysonTask);
  }

  async getTaskDependencies(taskId: string): Promise<Task[]> {
    const dysonTasks = await this.taskManager.getTaskDependencies(taskId);
    return dysonTasks.map(mapDysonTaskToTask);
  }

  async getDependentTasks(taskId: string): Promise<Task[]> {
    const dysonTasks = await this.taskManager.getDependentTasks(taskId);
    return dysonTasks.map(mapDysonTaskToTask);
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
