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
import { Tool, type ToolList } from "./types.js";

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
