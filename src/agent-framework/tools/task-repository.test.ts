/**
 * Task Repository Tests
 *
 * Tests for TaskRepository mapping functions.
 * Uses mocks to avoid writing to disk in tests.
 */

import { describe, it, expect } from "vitest";
import {
  mapDysonTaskToTask,
  mapCreateOptionsToDyson,
  mapUpdateOptionsToDyson,
  mapFilterToDyson,
} from "./dyson-swarm-task-repository.js";
import type {
  Task,
  TaskStatus,
  CreateTaskOptions,
  UpdateTaskOptions,
  TaskFilter,
} from "./task-repository.js";

describe("DysonSwarmTaskRepository mapping functions", () => {
  describe("mapDysonTaskToTask", () => {
    it("should map dyson task to our task type", () => {
      const dysonTask = {
        id: "task-123",
        frontmatter: {
          title: "Test Task",
          assignee: "user@example.com",
          dependsOn: ["dep-1", "dep-2"],
        },
        description: "Test description",
        status: "open" as const,
      };

      const task = mapDysonTaskToTask(dysonTask);

      expect(task.id).toBe("task-123");
      expect(task.frontmatter.title).toBe("Test Task");
      expect(task.frontmatter.assignee).toBe("user@example.com");
      expect(task.frontmatter.dependsOn).toEqual(["dep-1", "dep-2"]);
      expect(task.description).toBe("Test description");
      expect(task.status).toBe("open");
    });

    it("should handle optional fields", () => {
      const dysonTask = {
        id: "task-456",
        frontmatter: {
          title: "Simple Task",
        },
        description: "Simple description",
        status: "draft" as const,
      };

      const task = mapDysonTaskToTask(dysonTask);

      expect(task.id).toBe("task-456");
      expect(task.frontmatter.assignee).toBeUndefined();
      expect(task.frontmatter.dependsOn).toBeUndefined();
    });
  });

  describe("mapCreateOptionsToDyson", () => {
    it("should map create options to dyson format", () => {
      const options: CreateTaskOptions = {
        title: "New Task",
        description: "New description",
        assignee: "user@example.com",
        parentTaskId: "parent-123",
        dependsOn: ["dep-1"],
      };

      const dysonOptions = mapCreateOptionsToDyson(options);

      expect(dysonOptions.title).toBe("New Task");
      expect(dysonOptions.description).toBe("New description");
      expect(dysonOptions.assignee).toBe("user@example.com");
      expect(dysonOptions.parentTaskId).toBe("parent-123");
      expect(dysonOptions.dependsOn).toEqual(["dep-1"]);
    });

    it("should handle minimal options", () => {
      const options: CreateTaskOptions = {
        title: "Simple Task",
        description: "Simple description",
      };

      const dysonOptions = mapCreateOptionsToDyson(options);

      expect(dysonOptions.title).toBe("Simple Task");
      expect(dysonOptions.description).toBe("Simple description");
      expect(dysonOptions.assignee).toBeUndefined();
      expect(dysonOptions.parentTaskId).toBeUndefined();
      expect(dysonOptions.dependsOn).toBeUndefined();
    });
  });

  describe("mapUpdateOptionsToDyson", () => {
    it("should map update options to dyson format", () => {
      const options: UpdateTaskOptions = {
        title: "Updated Title",
        description: "Updated description",
        assignee: "new@example.com",
        dependsOn: ["new-dep"],
      };

      const dysonOptions = mapUpdateOptionsToDyson(options);

      expect(dysonOptions.title).toBe("Updated Title");
      expect(dysonOptions.description).toBe("Updated description");
      expect(dysonOptions.assignee).toBe("new@example.com");
      expect(dysonOptions.dependsOn).toEqual(["new-dep"]);
    });

    it("should handle partial updates", () => {
      const options: UpdateTaskOptions = {
        title: "Only Title",
      };

      const dysonOptions = mapUpdateOptionsToDyson(options);

      expect(dysonOptions.title).toBe("Only Title");
      expect(dysonOptions.description).toBeUndefined();
      expect(dysonOptions.assignee).toBeUndefined();
      expect(dysonOptions.dependsOn).toBeUndefined();
    });
  });

  describe("mapFilterToDyson", () => {
    it("should map filter to dyson format", () => {
      const filter: TaskFilter = {
        status: "draft",
        taskId: "task-123",
        dependsOn: "dep-1",
      };

      const dysonFilter = mapFilterToDyson(filter);

      expect(dysonFilter?.status).toBe("draft");
      expect(dysonFilter?.taskId).toBe("task-123");
      expect(dysonFilter?.dependsOn).toBe("dep-1");
    });

    it("should return undefined for undefined filter", () => {
      const dysonFilter = mapFilterToDyson(undefined);
      expect(dysonFilter).toBeUndefined();
    });

    it("should handle partial filters", () => {
      const filter: TaskFilter = {
        status: "closed",
      };

      const dysonFilter = mapFilterToDyson(filter);

      expect(dysonFilter?.status).toBe("closed");
      expect(dysonFilter?.taskId).toBeUndefined();
      expect(dysonFilter?.dependsOn).toBeUndefined();
    });
  });
});

describe("TaskRepository types", () => {
  it("should define Task type correctly", () => {
    const task: Task = {
      id: "task-123",
      frontmatter: {
        title: "Test Task",
        assignee: "user@example.com",
        dependsOn: ["dep-1"],
      },
      description: "Test description",
      status: "open" as TaskStatus,
    };

    expect(task.id).toBe("task-123");
    expect(task.frontmatter.title).toBe("Test Task");
    expect(task.status).toBe("open");
  });

  it("should define CreateTaskOptions correctly", () => {
    const options: CreateTaskOptions = {
      title: "New Task",
      description: "New description",
      assignee: "user@example.com",
      parentTaskId: "parent-123",
      dependsOn: ["dep-1"],
    };

    expect(options.title).toBe("New Task");
    expect(options.description).toBe("New description");
  });

  it("should define UpdateTaskOptions correctly", () => {
    const options: UpdateTaskOptions = {
      title: "Updated",
      description: "Updated desc",
    };

    expect(options.title).toBe("Updated");
  });

  it("should define TaskFilter correctly", () => {
    const filter: TaskFilter = {
      status: "draft",
      taskId: "task-123",
    };

    expect(filter.status).toBe("draft");
    expect(filter.taskId).toBe("task-123");
  });
});
