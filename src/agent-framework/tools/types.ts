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
  /** Create a new task */
  TASK_CREATE = "task_create",
  /** Get a single task by ID */
  TASK_GET = "task_get",
  /** List tasks with optional filters */
  TASK_LIST = "task_list",
  /** Update task properties */
  TASK_UPDATE = "task_update",
  /** Delete a task by ID */
  TASK_DELETE = "task_delete",
  /** Add a task dependency relationship */
  TASK_ADD_DEPENDENCY = "task_add_dependency",
  /** Remove a task dependency relationship */
  TASK_REMOVE_DEPENDENCY = "task_remove_dependency",
  /** Get tasks that a task depends on */
  TASK_GET_DEPENDENCIES = "task_get_dependencies",
  /** Get tasks that depend on a task */
  TASK_GET_DEPENDENTS = "task_get_dependents",
}

/**
 * Type for tool arrays - ensures we always use explicit tool lists
 */
export type ToolList = Tool[];
