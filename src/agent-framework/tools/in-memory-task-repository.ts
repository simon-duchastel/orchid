/**
 * In-Memory Task Repository
 *
 * Implementation of TaskRepository that stores tasks in memory.
 * Useful for testing and scenarios where persistence is not required.
 */

import type {
  TaskRepository,
  Task,
  TaskStatus,
  CreateTaskOptions,
  UpdateTaskOptions,
  TaskFilter,
} from "./task-repository.js";

/**
 * Task repository implementation using in-memory storage
 */
export class InMemoryTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  private idCounter = 0;

  async createTask(options: CreateTaskOptions): Promise<Task> {
    const id = `task-${++this.idCounter}`;
    const task: Task = {
      id,
      frontmatter: {
        title: options.title,
        assignee: options.assignee,
        dependsOn: options.dependsOn || [],
      },
      description: options.description,
      status: "draft",
    };
    this.tasks.set(id, task);
    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter((t) => t.status === filter.status);
    }

    return tasks;
  }

  async updateTask(taskId: string, options: UpdateTaskOptions): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    if (options.title !== undefined) {
      task.frontmatter.title = options.title;
    }
    if (options.description !== undefined) {
      task.description = options.description;
    }
    if (options.assignee !== undefined) {
      task.frontmatter.assignee = options.assignee;
    }
    if (options.dependsOn !== undefined) {
      task.frontmatter.dependsOn = options.dependsOn;
    }

    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.tasks.delete(taskId);
  }

  async addTaskDependency(taskId: string, dependencyId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    if (!task.frontmatter.dependsOn) {
      task.frontmatter.dependsOn = [];
    }
    if (!task.frontmatter.dependsOn.includes(dependencyId)) {
      task.frontmatter.dependsOn.push(dependencyId);
    }

    return task;
  }

  async removeTaskDependency(taskId: string, dependencyId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    if (task.frontmatter.dependsOn) {
      task.frontmatter.dependsOn = task.frontmatter.dependsOn.filter(
        (id) => id !== dependencyId
      );
    }

    return task;
  }

  async getTaskDependencies(taskId: string): Promise<Task[]> {
    const task = this.tasks.get(taskId);
    if (!task || !task.frontmatter.dependsOn) return [];

    return task.frontmatter.dependsOn
      .map((id) => this.tasks.get(id))
      .filter((t): t is Task => t !== undefined);
  }

  async getDependentTasks(taskId: string): Promise<Task[]> {
    const dependents: Task[] = [];
    for (const task of this.tasks.values()) {
      if (task.frontmatter.dependsOn?.includes(taskId)) {
        dependents.push(task);
      }
    }
    return dependents;
  }

  /**
   * Clear all tasks (useful for testing)
   */
  clear(): void {
    this.tasks.clear();
    this.idCounter = 0;
  }
}

/**
 * Factory function to create an InMemoryTaskRepository
 */
export function createInMemoryTaskRepository(): InMemoryTaskRepository {
  return new InMemoryTaskRepository();
}
