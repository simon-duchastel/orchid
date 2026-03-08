/**
 * Pi Tool Adapter
 *
 * Maps our Tool enum values to the underlying Pi SDK tool implementations.
 */

import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "@mariozechner/pi-coding-agent";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Tool, type ToolList } from "../../../tools/types.js";
import type { TaskRepository } from "../../../tools/task-repository.js";
import {
  createTaskCreateTool,
  createTaskGetTool,
  createTaskListTool,
  createTaskUpdateTool,
  createTaskDeleteTool,
  createTaskAddDependencyTool,
  createTaskRemoveDependencyTool,
  createTaskGetDependenciesTool,
  createTaskGetDependentsTool,
} from "../../../tools/task-tools.js";

// Pi tool type alias
export type PiTool = AgentTool<any>;

export interface MapToolsOptions {
  /** Array of tools to map */
  tools: ToolList;
  /** Working directory for tool execution */
  workingDirectory: string;
  /** Task repository for task operations (required if using task tools) */
  taskRepository?: TaskRepository;
}

/**
 * Maps a Tool enum value to its Pi SDK implementation
 */
function mapToolToPiTool(tool: Tool, workingDirectory: string, taskRepository?: TaskRepository): PiTool {
  switch (tool) {
    case Tool.READ:
      return createReadTool(workingDirectory);
    case Tool.BASH:
      return createBashTool(workingDirectory);
    case Tool.EDIT:
      return createEditTool(workingDirectory);
    case Tool.WRITE:
      return createWriteTool(workingDirectory);
    case Tool.GREP:
      return createGrepTool(workingDirectory);
    case Tool.FIND:
      return createFindTool(workingDirectory);
    case Tool.LS:
      return createLsTool(workingDirectory);
    case Tool.TASK_CREATE:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_CREATE tool");
      }
      return createTaskCreateTool(taskRepository);
    case Tool.TASK_GET:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_GET tool");
      }
      return createTaskGetTool(taskRepository);
    case Tool.TASK_LIST:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_LIST tool");
      }
      return createTaskListTool(taskRepository);
    case Tool.TASK_UPDATE:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_UPDATE tool");
      }
      return createTaskUpdateTool(taskRepository);
    case Tool.TASK_DELETE:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_DELETE tool");
      }
      return createTaskDeleteTool(taskRepository);
    case Tool.TASK_ADD_DEPENDENCY:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_ADD_DEPENDENCY tool");
      }
      return createTaskAddDependencyTool(taskRepository);
    case Tool.TASK_REMOVE_DEPENDENCY:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_REMOVE_DEPENDENCY tool");
      }
      return createTaskRemoveDependencyTool(taskRepository);
    case Tool.TASK_GET_DEPENDENCIES:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_GET_DEPENDENCIES tool");
      }
      return createTaskGetDependenciesTool(taskRepository);
    case Tool.TASK_GET_DEPENDENTS:
      if (!taskRepository) {
        throw new Error("Task repository required for TASK_GET_DEPENDENTS tool");
      }
      return createTaskGetDependentsTool(taskRepository);
    default:
      // This should never happen if we handle all enum values
      throw new Error(`Unknown tool: ${String(tool)}`);
  }
}

/**
 * Maps an array of Tool enum values to Pi SDK tool implementations
 *
 * @param options - Configuration options
 * @returns Array of Pi SDK tool implementations
 */
export function mapToolsToPiTools(options: MapToolsOptions): PiTool[] {
  const { tools, workingDirectory, taskRepository } = options;
  return tools.map((tool) => mapToolToPiTool(tool, workingDirectory, taskRepository));
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use mapToolsToPiTools with options object instead
 */
export function mapToolsToPiToolsLegacy(tools: ToolList, workingDirectory: string): PiTool[] {
  return tools.map((tool) => mapToolToPiTool(tool, workingDirectory, undefined));
}
