/**
 * Tools Module
 *
 * Exports tool types for agents.
 */

export { Tool, type ToolList } from "./types.js";
export type { Task, TaskStatus, TaskFilter, CreateTaskOptions, UpdateTaskOptions } from "./task-repository.js";
export { TaskRepository } from "./task-repository.js";
export { DysonSwarmTaskRepository, createDysonSwarmTaskRepository } from "./dyson-swarm-task-repository.js";
export { InMemoryTaskRepository, createInMemoryTaskRepository } from "./in-memory-task-repository.js";
export {
  createTaskCreateTool,
  createTaskGetTool,
  createTaskListTool,
  createTaskUpdateTool,
  createTaskDeleteTool,
  createTaskAddDependencyTool,
  createTaskRemoveDependencyTool,
  createTaskGetDependenciesTool,
  createTaskGetDependentsTool,
} from "./task-tools.js";
