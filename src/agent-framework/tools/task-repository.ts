/**
 * Task Repository
 *
 * Abstracts task storage operations behind a clean interface.
 * Allows swapping between different storage implementations (in-memory, dyson-swarm, etc.)
 */

import type {
  Task,
  TaskStatus,
  CreateTaskOptions,
  UpdateTaskOptions,
  TaskFilter,
} from "dyson-swarm";

/**
 * Repository interface for task operations
 * Implementations can use different storage backends
 */
export interface TaskRepository {
  /**
   * Create a new task
   */
  createTask(options: CreateTaskOptions): Promise<Task>;

  /**
   * Get a single task by ID
   */
  getTask(taskId: string): Promise<Task | null>;

  /**
   * List tasks with optional filtering
   */
  listTasks(filter?: TaskFilter): Promise<Task[]>;

  /**
   * Update a task's properties
   */
  updateTask(taskId: string, options: UpdateTaskOptions): Promise<Task | null>;

  /**
   * Delete a task by ID
   */
  deleteTask(taskId: string): Promise<boolean>;

  /**
   * Add a dependency relationship between two tasks
   */
  addTaskDependency(taskId: string, dependencyId: string): Promise<Task | null>;

  /**
   * Remove a dependency relationship between two tasks
   */
  removeTaskDependency(taskId: string, dependencyId: string): Promise<Task | null>;

  /**
   * Get all tasks that a specific task depends on
   */
  getTaskDependencies(taskId: string): Promise<Task[]>;

  /**
   * Get all tasks that depend on a specific task
   */
  getDependentTasks(taskId: string): Promise<Task[]>;
}

/**
 * Re-export types from dyson-swarm for convenience
 */
export type { Task, TaskStatus, CreateTaskOptions, UpdateTaskOptions, TaskFilter };
