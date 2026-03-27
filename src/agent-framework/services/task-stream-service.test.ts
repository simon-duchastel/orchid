import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TaskStreamService, createTaskStreamService, type TaskChangeEvent, type TaskChangeCallback } from "./task-stream-service.js";
import type { Task as DysonTask, TaskFilter } from "dyson-swarm";

const mocks = vi.hoisted(() => {
  const mockListTaskStream = vi.fn();

  class MockTaskManager {
    listTaskStream = mockListTaskStream;
  }

  return {
    mockListTaskStream,
    MockTaskManager,
  };
});

vi.mock("dyson-swarm", () => ({
  TaskManager: mocks.MockTaskManager,
}));

describe("TaskStreamService", () => {
  let service: TaskStreamService;
  const mockCwdProvider = () => "/test/cwd";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = createTaskStreamService({ cwdProvider: mockCwdProvider });
  });

  afterEach(async () => {
    await service.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should start the service and listen to task stream", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      const startPromise = service.start();
      await vi.runAllTimersAsync();
      await startPromise;

      expect(mocks.mockListTaskStream).toHaveBeenCalledWith(undefined);
      expect(service.isServiceRunning()).toBe(true);
    });

    it("should accept a filter when starting", async () => {
      const filter: TaskFilter = { status: "open" };
      service = createTaskStreamService({ cwdProvider: mockCwdProvider, filter });

      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      const startPromise = service.start();
      await vi.runAllTimersAsync();
      await startPromise;

      expect(mocks.mockListTaskStream).toHaveBeenCalledWith(filter);
    });

    it("should not start if already running", async () => {
      const streamIterator = (async function* () {
        yield [];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.start();
      await vi.runAllTimersAsync();

      // Try to start again
      await service.start();

      expect(mocks.mockListTaskStream).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("should stop the service", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.start();
      await vi.runAllTimersAsync();

      await service.stop();

      expect(service.isServiceRunning()).toBe(false);
    });

    it("should clear all tracked tasks on stop", async () => {
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };

      const streamIterator = (async function* () {
        yield [task];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.start();
      await vi.runAllTimersAsync();

      expect(service.getCurrentTasks()).toHaveLength(1);

      await service.stop();

      expect(service.getCurrentTasks()).toHaveLength(0);
    });

    it("should handle multiple stop calls gracefully", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.start();
      await vi.runAllTimersAsync();

      await service.stop();
      await service.stop(); // Should not throw

      expect(service.isServiceRunning()).toBe(false);
    });
  });

  describe("task change callbacks", () => {
    it("should notify when a new task is added", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };

      const streamIterator = (async function* () {
        yield [task];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith({
        type: "added",
        task,
      });
    });

    it("should notify when a task is removed", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };

      const streamIterator = (async function* () {
        yield [task];
        yield []; // Task removed
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith({
        type: "added",
        task,
      });

      expect(callback).toHaveBeenCalledWith({
        type: "removed",
        task,
      });
    });

    it("should notify when a task is updated", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      const updatedTask: DysonTask = {
        ...task,
        frontmatter: { ...task.frontmatter, title: "Updated Task" },
      };

      const streamIterator = (async function* () {
        yield [task];
        yield [updatedTask];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith({
        type: "added",
        task,
      });

      expect(callback).toHaveBeenCalledWith({
        type: "updated",
        task: updatedTask,
        previousTask: task,
      });
    });

    it("should support multiple callbacks", async () => {
      const callback1 = vi.fn() as TaskChangeCallback;
      const callback2 = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };

      const streamIterator = (async function* () {
        yield [task];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback1);
      service.onTaskChange(callback2);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it("should allow unsubscribing from callbacks", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };

      const streamIterator = (async function* () {
        yield [task];
        yield [task]; // Second yield
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      const unsubscribe = service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1); // Only "added"

      // Unsubscribe
      unsubscribe();

      // Wait for next iteration
      await vi.advanceTimersByTimeAsync(1000);
    });

    it("should not notify for unchanged tasks", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };

      const streamIterator = (async function* () {
        yield [task];
        yield [task]; // Same task, no change
        yield [task]; // Same task again
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1); // Only "added"
    });

    it("should handle callback errors gracefully", async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error("Callback error");
      }) as TaskChangeCallback;
      const successCallback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };

      const streamIterator = (async function* () {
        yield [task];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(errorCallback);
      service.onTaskChange(successCallback);
      service.start();
      await vi.runAllTimersAsync();

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled(); // Should still be called despite error in previous callback
    });
  });

  describe("getCurrentTasks", () => {
    it("should return empty array when no tasks tracked", () => {
      expect(service.getCurrentTasks()).toEqual([]);
    });

    it("should return all tracked tasks", async () => {
      const task1: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Task 1", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      const task2: DysonTask = {
        id: "task-2",
        frontmatter: { title: "Task 2", assignee: undefined, dependsOn: [] },
        description: "",
        status: "in-progress",
      };

      const streamIterator = (async function* () {
        yield [task1, task2];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.start();
      await vi.runAllTimersAsync();

      const tasks = service.getCurrentTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.id)).toContain("task-1");
      expect(tasks.map(t => t.id)).toContain("task-2");
    });
  });

  describe("task equality", () => {
    it("should detect title changes", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Old Title", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      const updatedTask: DysonTask = {
        ...task,
        frontmatter: { ...task.frontmatter, title: "New Title" },
      };

      const streamIterator = (async function* () {
        yield [task];
        yield [updatedTask];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updated",
          task: updatedTask,
        })
      );
    });

    it("should detect status changes", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      const updatedTask: DysonTask = {
        ...task,
        status: "in-progress",
      };

      const streamIterator = (async function* () {
        yield [task];
        yield [updatedTask];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updated",
          task: updatedTask,
        })
      );
    });

    it("should detect assignee changes", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      const updatedTask: DysonTask = {
        ...task,
        frontmatter: { ...task.frontmatter, assignee: "user1" },
      };

      const streamIterator = (async function* () {
        yield [task];
        yield [updatedTask];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updated",
          task: updatedTask,
        })
      );
    });

    it("should detect dependency changes", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      const updatedTask: DysonTask = {
        ...task,
        frontmatter: { ...task.frontmatter, dependsOn: ["task-0"] },
      };

      const streamIterator = (async function* () {
        yield [task];
        yield [updatedTask];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updated",
          task: updatedTask,
        })
      );
    });

    it("should detect description changes", async () => {
      const callback = vi.fn() as TaskChangeCallback;
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test Task", assignee: undefined, dependsOn: [] },
        description: "Old description",
        status: "open",
      };
      const updatedTask: DysonTask = {
        ...task,
        description: "New description",
      };

      const streamIterator = (async function* () {
        yield [task];
        yield [updatedTask];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      service.onTaskChange(callback);
      service.start();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "updated",
          task: updatedTask,
        })
      );
    });
  });

  describe("createTaskStreamService", () => {
    it("should create a TaskStreamService instance", () => {
      const service = createTaskStreamService({ cwdProvider: mockCwdProvider });
      expect(service).toBeInstanceOf(TaskStreamService);
    });
  });
});
