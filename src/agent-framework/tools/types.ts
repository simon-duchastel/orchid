/**
 * Tool Type Definitions
 *
 * Defines the available tools for agents. This abstracts the underlying
 * Pi SDK tools so we can add custom tools in the future.
 */

/**
 * Available tools for agents
 */
export enum Tool {
  /** Read file contents with offset/limit */
  READ = "read",
  /** Execute bash commands with timeout */
  BASH = "bash",
  /** Edit files (search and replace) */
  EDIT = "edit",
  /** Write/create new files */
  WRITE = "write",
  /** Search file contents with regex patterns */
  GREP = "grep",
  /** Find files by pattern */
  FIND = "find",
  /** List directory contents */
  LS = "ls",
}

/**
 * Type for tool arrays - ensures we always use explicit tool lists
 */
export type ToolList = Tool[];
