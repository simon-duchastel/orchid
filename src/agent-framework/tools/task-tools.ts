/**
 * Task Tools
 *
 * Custom tools for task manipulation operations.
 * These provide first-class task management capabilities for agents.
 */

import { Type, type Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TaskRepository, Task, TaskStatus } from "./task-repository.js";

// Schema definitions
const TaskCreateSchema = Type.Object({
  title: Type.String({ description: "Title of the task" }),
  description: Type.String({ description: "Description of the task" }),
  assignee: Type.Optional(Type.String({ description: "Optional assignee" })),
  dependsOn: Type.Optional(
    Type.Array(Type.String(), { description: "Task IDs this task depends on" })
  ),
});

const TaskGetSchema = Type.Object({
  taskId: Type.String({ description: "ID of the task to retrieve" }),
});

const TaskListSchema = Type.Object({
  status: Type.Optional(
    Type.String({
      description: "Filter by status: draft, open, in-progress, or closed",
    })
  ),
});

const TaskUpdateSchema = Type.Object({
  taskId: Type.String({ description: "ID of the task to update" }),
  title: Type.Optional(Type.String({ description: "New title" })),
  description: Type.Optional(Type.String({ description: "New description" })),
});

const TaskDeleteSchema = Type.Object({
  taskId: Type.String({ description: "ID of the task to delete" }),
});

const TaskAddDependencySchema = Type.Object({
  taskId: Type.String({
    description: "ID of the task to add a dependency to",
  }),
  dependencyId: Type.String({ description: "ID of the dependency task" }),
});

const TaskRemoveDependencySchema = Type.Object({
  taskId: Type.String({
    description: "ID of the task to remove a dependency from",
  }),
  dependencyId: Type.String({ description: "ID of the dependency to remove" }),
});

const TaskGetDependenciesSchema = Type.Object({
  taskId: Type.String({
    description: "ID of the task to get dependencies for",
  }),
});

const TaskGetDependentsSchema = Type.Object({
  taskId: Type.String({
    description: "ID of the task to get dependents for",
  }),
});

// Tool factory functions that accept a TaskRepository

export function createTaskCreateTool(
  repository: TaskRepository
): AgentTool<typeof TaskCreateSchema> {
  return {
    name: "task_create",
    description: "Create a new task with title, description, and optional dependencies",
    parameters: TaskCreateSchema,
    label: "Task Create",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskCreateSchema>
    ): Promise<AgentToolResult<{ task: Task }>> => {
      const task = await repository.createTask({
        title: params.title,
        description: params.description,
        assignee: params.assignee,
        dependsOn: params.dependsOn,
      });
      return {
        content: [{ type: "text", text: `Created task ${task.id}: ${task.frontmatter.title}` }],
        details: { task },
      };
    },
  };
}

export function createTaskGetTool(
  repository: TaskRepository
): AgentTool<typeof TaskGetSchema> {
  return {
    name: "task_get",
    description: "Retrieve a single task by its ID",
    parameters: TaskGetSchema,
    label: "Task Get",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskGetSchema>
    ): Promise<AgentToolResult<{ task: Task | null }>> => {
      const task = await repository.getTask(params.taskId);
      const text = task
        ? `Task ${task.id}: ${task.frontmatter.title}\nStatus: ${task.status}\nDescription: ${task.description}`
        : `Task ${params.taskId} not found`;
      return {
        content: [{ type: "text", text }],
        details: { task },
      };
    },
  };
}

export function createTaskListTool(
  repository: TaskRepository
): AgentTool<typeof TaskListSchema> {
  return {
    name: "task_list",
    description: "List all tasks with optional filtering by status",
    parameters: TaskListSchema,
    label: "Task List",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskListSchema>
    ): Promise<AgentToolResult<{ tasks: Task[] }>> => {
      const tasks = await repository.listTasks(
        params.status ? { status: params.status as TaskStatus } : undefined
      );
      const taskList = tasks
        .map((t) => `- ${t.id}: ${t.frontmatter.title} (${t.status})`)
        .join("\n");
      const text = tasks.length > 0 ? `Tasks:\n${taskList}` : "No tasks found";
      return {
        content: [{ type: "text", text }],
        details: { tasks },
      };
    },
  };
}

export function createTaskUpdateTool(
  repository: TaskRepository
): AgentTool<typeof TaskUpdateSchema> {
  return {
    name: "task_update",
    description: "Update a task's title and/or description",
    parameters: TaskUpdateSchema,
    label: "Task Update",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskUpdateSchema>
    ): Promise<AgentToolResult<{ task: Task | null }>> => {
      const task = await repository.updateTask(params.taskId, {
        title: params.title,
        description: params.description,
      });
      const text = task
        ? `Updated task ${task.id}: ${task.frontmatter.title}`
        : `Task ${params.taskId} not found`;
      return {
        content: [{ type: "text", text }],
        details: { task },
      };
    },
  };
}

export function createTaskDeleteTool(
  repository: TaskRepository
): AgentTool<typeof TaskDeleteSchema> {
  return {
    name: "task_delete",
    description: "Delete a task by its ID",
    parameters: TaskDeleteSchema,
    label: "Task Delete",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskDeleteSchema>
    ): Promise<AgentToolResult<{ success: boolean }>> => {
      const success = await repository.deleteTask(params.taskId);
      const text = success
        ? `Deleted task ${params.taskId}`
        : `Task ${params.taskId} not found`;
      return {
        content: [{ type: "text", text }],
        details: { success },
      };
    },
  };
}

export function createTaskAddDependencyTool(
  repository: TaskRepository
): AgentTool<typeof TaskAddDependencySchema> {
  return {
    name: "task_add_dependency",
    description: "Add a dependency relationship between two tasks",
    parameters: TaskAddDependencySchema,
    label: "Task Add Dependency",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskAddDependencySchema>
    ): Promise<AgentToolResult<{ task: Task | null }>> => {
      const task = await repository.addTaskDependency(params.taskId, params.dependencyId);
      const text = task
        ? `Added dependency ${params.dependencyId} to task ${params.taskId}`
        : `Task ${params.taskId} not found`;
      return {
        content: [{ type: "text", text }],
        details: { task },
      };
    },
  };
}

export function createTaskRemoveDependencyTool(
  repository: TaskRepository
): AgentTool<typeof TaskRemoveDependencySchema> {
  return {
    name: "task_remove_dependency",
    description: "Remove a dependency relationship between two tasks",
    parameters: TaskRemoveDependencySchema,
    label: "Task Remove Dependency",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskRemoveDependencySchema>
    ): Promise<AgentToolResult<{ task: Task | null }>> => {
      const task = await repository.removeTaskDependency(params.taskId, params.dependencyId);
      const text = task
        ? `Removed dependency ${params.dependencyId} from task ${params.taskId}`
        : `Task ${params.taskId} not found`;
      return {
        content: [{ type: "text", text }],
        details: { task },
      };
    },
  };
}

export function createTaskGetDependenciesTool(
  repository: TaskRepository
): AgentTool<typeof TaskGetDependenciesSchema> {
  return {
    name: "task_get_dependencies",
    description: "Get all tasks that a specific task depends on",
    parameters: TaskGetDependenciesSchema,
    label: "Task Get Dependencies",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskGetDependenciesSchema>
    ): Promise<AgentToolResult<{ dependencies: Task[] }>> => {
      const dependencies = await repository.getTaskDependencies(params.taskId);
      const depList = dependencies
        .map((t) => `- ${t.id}: ${t.frontmatter.title}`)
        .join("\n");
      const text =
        dependencies.length > 0
          ? `Task ${params.taskId} depends on:\n${depList}`
          : `Task ${params.taskId} has no dependencies`;
      return {
        content: [{ type: "text", text }],
        details: { dependencies },
      };
    },
  };
}

export function createTaskGetDependentsTool(
  repository: TaskRepository
): AgentTool<typeof TaskGetDependentsSchema> {
  return {
    name: "task_get_dependents",
    description: "Get all tasks that depend on a specific task",
    parameters: TaskGetDependentsSchema,
    label: "Task Get Dependents",
    execute: async (
      _toolCallId: string,
      params: Static<typeof TaskGetDependentsSchema>
    ): Promise<AgentToolResult<{ dependents: Task[] }>> => {
      const dependents = await repository.getDependentTasks(params.taskId);
      const depList = dependents
        .map((t) => `- ${t.id}: ${t.frontmatter.title}`)
        .join("\n");
      const text =
        dependents.length > 0
          ? `Tasks depending on ${params.taskId}:\n${depList}`
          : `No tasks depend on ${params.taskId}`;
      return {
        content: [{ type: "text", text }],
        details: { dependents },
      };
    },
  };
}
