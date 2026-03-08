/**
 * Task Repository Tests
 *
 * Tests for both InMemoryTaskRepository and DysonSwarmTaskRepository implementations.
 * Uses a shared test suite to ensure both implementations behave consistently.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  InMemoryTaskRepository,
  createInMemoryTaskRepository,
} from "./in-memory-task-repository.js";
import {
  DysonSwarmTaskRepository,
  createDysonSwarmTaskRepository,
} from "./dyson-swarm-task-repository.js";
import { initializeForce } from "dyson-swarm";
import type { TaskRepository } from "./task-repository.js";

// Shared test suite for TaskRepository implementations
function runTaskRepositoryTests(
  name: string,
  createRepository: () => Promise<TaskRepository>,
  cleanup?: () => void
) {
  describe(name, () => {
    let repository: TaskRepository;

    beforeEach(async () => {
      repository = await createRepository();
    });

    afterEach(() => {
      if (cleanup) {
        cleanup();
      }
    });

    describe("createTask", () => {
      it("should create a task with title and description", async () => {
        const task = await repository.createTask({
          title: "Test Task",
          description: "Test description",
        });

        expect(task.id).toBeDefined();
        expect(task.frontmatter.title).toBe("Test Task");
        expect(task.description).toBe("Test description");
        // Note: dyson-swarm creates tasks with "open" status by default
      });

      it("should create a task with optional assignee", async () => {
        const task = await repository.createTask({
          title: "Assigned Task",
          description: "Assigned description",
          assignee: "user@example.com",
        });

        expect(task.frontmatter.assignee).toBe("user@example.com");
      });

      it("should create a task with dependencies", async () => {
        const depTask = await repository.createTask({
          title: "Dependency",
          description: "Dependency task",
        });

        const task = await repository.createTask({
          title: "Main Task",
          description: "Main description",
          dependsOn: [depTask.id],
        });

        expect(task.frontmatter.dependsOn).toContain(depTask.id);
      });
    });

    describe("getTask", () => {
      it("should retrieve a task by ID", async () => {
        const created = await repository.createTask({
          title: "Get Task",
          description: "Get description",
        });

        const retrieved = await repository.getTask(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.frontmatter.title).toBe("Get Task");
      });

      it("should return null for non-existent task", async () => {
        const task = await repository.getTask("non-existent-id");
        expect(task).toBeNull();
      });
    });

    describe("listTasks", () => {
      it("should return all tasks when no filter", async () => {
        await repository.createTask({
          title: "Task 1",
          description: "Description 1",
        });
        await repository.createTask({
          title: "Task 2",
          description: "Description 2",
        });

        const tasks = await repository.listTasks();
        expect(tasks).toHaveLength(2);
      });

      it("should filter by status", async () => {
        const task1 = await repository.createTask({
          title: "Task 1",
          description: "Description 1",
        });

        await repository.createTask({
          title: "Task 2",
          description: "Description 2",
        });

        // Filter by status (in-memory will have status, dyson-swarm starts as draft)
        const tasks = await repository.listTasks({ status: "draft" });
        expect(tasks.length).toBeGreaterThanOrEqual(1);
      });

      it("should return empty array when no tasks match filter", async () => {
        await repository.createTask({
          title: "Task",
          description: "Description",
        });

        const tasks = await repository.listTasks({ status: "closed" });
        expect(tasks).toHaveLength(0);
      });
    });

    describe("updateTask", () => {
      it("should update task title", async () => {
        const task = await repository.createTask({
          title: "Original Title",
          description: "Description",
        });

        const updated = await repository.updateTask(task.id, {
          title: "Updated Title",
        });

        expect(updated).not.toBeNull();
        expect(updated?.frontmatter.title).toBe("Updated Title");
        expect(updated?.description).toBe("Description");
      });

      it("should update task description", async () => {
        const task = await repository.createTask({
          title: "Title",
          description: "Original description",
        });

        const updated = await repository.updateTask(task.id, {
          description: "Updated description",
        });

        expect(updated).not.toBeNull();
        expect(updated?.description).toBe("Updated description");
      });

      it("should return null for non-existent task", async () => {
        const updated = await repository.updateTask("non-existent", {
          title: "New Title",
        });
        expect(updated).toBeNull();
      });
    });

    describe("deleteTask", () => {
      it("should delete an existing task", async () => {
        const task = await repository.createTask({
          title: "To Delete",
          description: "Will be deleted",
        });

        const deleted = await repository.deleteTask(task.id);
        expect(deleted).toBe(true);

        const retrieved = await repository.getTask(task.id);
        expect(retrieved).toBeNull();
      });

      it("should return false for non-existent task", async () => {
        const deleted = await repository.deleteTask("non-existent");
        expect(deleted).toBe(false);
      });
    });

    describe("addTaskDependency", () => {
      it("should add a dependency to a task", async () => {
        const depTask = await repository.createTask({
          title: "Dependency",
          description: "Dependency task",
        });

        const mainTask = await repository.createTask({
          title: "Main Task",
          description: "Main task",
        });

        const updated = await repository.addTaskDependency(mainTask.id, depTask.id);

        expect(updated).not.toBeNull();
        expect(updated?.frontmatter.dependsOn).toContain(depTask.id);
      });

      it("should return null for non-existent task", async () => {
        const result = await repository.addTaskDependency("non-existent", "other");
        expect(result).toBeNull();
      });
    });

    describe("removeTaskDependency", () => {
      it("should remove a dependency from a task", async () => {
        const depTask = await repository.createTask({
          title: "Dependency",
          description: "Dependency task",
        });

        const mainTask = await repository.createTask({
          title: "Main Task",
          description: "Main task",
          dependsOn: [depTask.id],
        });

        const updated = await repository.removeTaskDependency(mainTask.id, depTask.id);

        expect(updated).not.toBeNull();
        expect(updated?.frontmatter.dependsOn).not.toContain(depTask.id);
      });

      it("should return null for non-existent task", async () => {
        const result = await repository.removeTaskDependency("non-existent", "other");
        expect(result).toBeNull();
      });
    });

    describe("getTaskDependencies", () => {
      it("should get all dependencies for a task", async () => {
        const depTask = await repository.createTask({
          title: "Dependency",
          description: "Dependency task",
        });

        const mainTask = await repository.createTask({
          title: "Main Task",
          description: "Main task",
          dependsOn: [depTask.id],
        });

        const dependencies = await repository.getTaskDependencies(mainTask.id);

        expect(dependencies).toHaveLength(1);
        expect(dependencies[0].id).toBe(depTask.id);
      });

      it("should return empty array when task has no dependencies", async () => {
        const task = await repository.createTask({
          title: "Task",
          description: "No deps",
        });

        const dependencies = await repository.getTaskDependencies(task.id);
        expect(dependencies).toHaveLength(0);
      });
    });

    describe("getDependentTasks", () => {
      it("should get all tasks that depend on a task", async () => {
        const depTask = await repository.createTask({
          title: "Dependency",
          description: "Dependency task",
        });

        const mainTask = await repository.createTask({
          title: "Main Task",
          description: "Main task",
          dependsOn: [depTask.id],
        });

        const dependents = await repository.getDependentTasks(depTask.id);

        expect(dependents).toHaveLength(1);
        expect(dependents[0].id).toBe(mainTask.id);
      });

      it("should return empty array when no tasks depend on a task", async () => {
        const task = await repository.createTask({
          title: "Task",
          description: "No dependents",
        });

        const dependents = await repository.getDependentTasks(task.id);
        expect(dependents).toHaveLength(0);
      });
    });
  });
}

// Run tests for InMemoryTaskRepository
describe("Task Repository Implementations", () => {
  let inMemoryRepo: InMemoryTaskRepository;

  runTaskRepositoryTests(
    "InMemoryTaskRepository",
    async () => {
      inMemoryRepo = createInMemoryTaskRepository();
      return inMemoryRepo;
    },
    () => {
      inMemoryRepo.clear();
    }
  );

  // Run tests for DysonSwarmTaskRepository
  let dysonTestDir: string;

  runTaskRepositoryTests(
    "DysonSwarmTaskRepository",
    async () => {
      dysonTestDir = join(tmpdir(), `orchid-dyson-test-${Date.now()}-${Math.random()}`);
      mkdirSync(dysonTestDir, { recursive: true });

      const cwdProvider = () => dysonTestDir;

      // Initialize dyson-swarm for this directory
      await initializeForce(cwdProvider);

      return createDysonSwarmTaskRepository({ cwdProvider });
    },
    () => {
      // Cleanup: remove test directory
      if (dysonTestDir && existsSync(dysonTestDir)) {
        rmSync(dysonTestDir, { recursive: true, force: true });
      }
    }
  );

  // Additional InMemoryTaskRepository specific tests
  describe("InMemoryTaskRepository specific", () => {
    let repository: InMemoryTaskRepository;

    beforeEach(() => {
      repository = createInMemoryTaskRepository();
    });

    afterEach(() => {
      repository.clear();
    });

    it("clear should remove all tasks", async () => {
      await repository.createTask({
        title: "Task 1",
        description: "Description 1",
      });
      await repository.createTask({
        title: "Task 2",
        description: "Description 2",
      });

      repository.clear();

      const tasks = await repository.listTasks();
      expect(tasks).toHaveLength(0);
    });

    it("should auto-increment task IDs", async () => {
      const task1 = await repository.createTask({
        title: "Task 1",
        description: "Description 1",
      });
      const task2 = await repository.createTask({
        title: "Task 2",
        description: "Description 2",
      });

      expect(task1.id).toBe("task-1");
      expect(task2.id).toBe("task-2");
    });
  });

  // Additional DysonSwarmTaskRepository specific tests
  describe("DysonSwarmTaskRepository specific", () => {
    const testDir = join(tmpdir(), `orchid-dyson-specific-test-${Date.now()}`);

    beforeEach(async () => {
      mkdirSync(testDir, { recursive: true });
      await initializeForce(() => testDir);
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should use custom cwdProvider", async () => {
      const repo = createDysonSwarmTaskRepository({
        cwdProvider: () => testDir,
      });

      // Create a task to verify it works
      const task = await repo.createTask({
        title: "Test Task",
        description: "Test description",
      });

      expect(task.id).toBeDefined();
      expect(task.frontmatter.title).toBe("Test Task");
    });
  });
});
