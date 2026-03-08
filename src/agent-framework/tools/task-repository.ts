/**
 * Task Repository
 *
 * Abstracts task storage operations behind a clean interface.
 * Allows swapping between different storage implementations (in-memory, dyson-swarm, etc.)
 */

/**
 * Task status values
 */
export type TaskStatus = 'draft' | 'open' | 'in-progress' | 'closed';

/**
 * Task frontmatter/metadata
 */
export interface TaskFrontmatter {
  title: string;
  assignee?: string;
  dependsOn?: string[];
}

/**
 * Task entity
 */
export interface Task {
  id: string;
  frontmatter: TaskFrontmatter;
  description: string;
  status: TaskStatus;
}

/**
 * Options for creating a task
 */
export interface CreateTaskOptions {
  title: string;
  description: string;
  assignee?: string;
  parentTaskId?: string;
  dependsOn?: string[];
}

/**
 * Options for updating a task
 */
export interface UpdateTaskOptions {
  title?: string;
  description?: string;
  assignee?: string;
  dependsOn?: string[];
}

/**
 * Filter options for listing tasks
 */
export interface TaskFilter {
  status?: TaskStatus;
  taskId?: string;
  dependsOn?: string;
}

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
