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

/**
 * Maps a Tool enum value to its Pi SDK implementation
 */
function mapToolToPiTool(tool: Tool, workingDirectory: string): PiTool {
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
      return createTaskCreateTool();
    case Tool.TASK_GET:
      return createTaskGetTool();
    case Tool.TASK_LIST:
      return createTaskListTool();
    case Tool.TASK_UPDATE:
      return createTaskUpdateTool();
    case Tool.TASK_DELETE:
      return createTaskDeleteTool();
    case Tool.TASK_ADD_DEPENDENCY:
      return createTaskAddDependencyTool();
    case Tool.TASK_REMOVE_DEPENDENCY:
      return createTaskRemoveDependencyTool();
    case Tool.TASK_GET_DEPENDENCIES:
      return createTaskGetDependenciesTool();
    case Tool.TASK_GET_DEPENDENTS:
      return createTaskGetDependentsTool();
    default:
      // This should never happen if we handle all enum values
      throw new Error(`Unknown tool: ${String(tool)}`);
  }
}

/**
 * Maps an array of Tool enum values to Pi SDK tool implementations
 *
 * @param tools - Array of tools to map
 * @param workingDirectory - The working directory for tool execution
 * @returns Array of Pi SDK tool implementations
 */
export function mapToolsToPiTools(tools: ToolList, workingDirectory: string): PiTool[] {
  return tools.map((tool) => mapToolToPiTool(tool, workingDirectory));
}
