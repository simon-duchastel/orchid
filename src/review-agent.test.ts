import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReviewAgent } from "./review-agent";
import type { AgentSession } from "./opencode-session";

// Mock the logger
vi.mock("./utils/logger.js", () => ({
  log: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe("ReviewAgent", () => {
  let reviewAgent: ReviewAgent;
  const mockSession: AgentSession = {
    sessionId: "test-session-123",
    taskId: "test-task-456",
    workingDirectory: "/test/worktrees/test-task-456",
    client: {} as any,
    createdAt: new Date(),
    status: "running",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reviewAgent = new ReviewAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("invokeReview", () => {
    it("should invoke review for a session", async () => {
      const { log } = await import("./utils/logger.js");

      await reviewAgent.invokeReview(mockSession);

      // Should log the invocation
      expect(log.log).toHaveBeenCalledWith(
        expect.stringContaining("test-task-456")
      );
    });

    it("should call onReviewInvoked callback if provided", async () => {
      const onReviewInvoked = vi.fn();
      const customReviewAgent = new ReviewAgent({ onReviewInvoked });

      await customReviewAgent.invokeReview(mockSession);

      expect(onReviewInvoked).toHaveBeenCalledWith(
        "test-task-456",
        "test-session-123"
      );
    });

    it("should handle sessions with different IDs", async () => {
      const onReviewInvoked = vi.fn();
      const customReviewAgent = new ReviewAgent({ onReviewInvoked });

      const anotherSession: AgentSession = {
        sessionId: "session-abc",
        taskId: "task-xyz",
        workingDirectory: "/test/worktrees/task-xyz",
        client: {} as any,
        createdAt: new Date(),
        status: "running",
      };

      await customReviewAgent.invokeReview(anotherSession);

      expect(onReviewInvoked).toHaveBeenCalledWith("task-xyz", "session-abc");
    });
  });

  describe("shouldReview", () => {
    it("should return true by default", () => {
      expect(reviewAgent.shouldReview(mockSession)).toBe(true);
    });

    it("should allow overriding in subclass", () => {
      class CustomReviewAgent extends ReviewAgent {
        shouldReview(session: AgentSession): boolean {
          // Only review tasks with specific pattern
          return session.taskId.startsWith("reviewable-");
        }
      }

      const customAgent = new CustomReviewAgent();

      const reviewableSession: AgentSession = {
        ...mockSession,
        taskId: "reviewable-task",
      };
      const nonReviewableSession: AgentSession = {
        ...mockSession,
        taskId: "skip-task",
      };

      expect(customAgent.shouldReview(reviewableSession)).toBe(true);
      expect(customAgent.shouldReview(nonReviewableSession)).toBe(false);
    });
  });

  describe("logging", () => {
    it("should log session and task information", async () => {
      const { log } = await import("./utils/logger.js");

      await reviewAgent.invokeReview(mockSession);

      expect(log.log).toHaveBeenCalledWith(
        expect.stringContaining("[review-agent]")
      );
      expect(log.log).toHaveBeenCalledWith(
        expect.stringContaining("test-session-123")
      );
      expect(log.log).toHaveBeenCalledWith(
        expect.stringContaining("/test/worktrees/test-task-456")
      );
    });
  });

  describe("default options", () => {
    it("should work without any options", () => {
      const agent = new ReviewAgent();
      expect(agent).toBeDefined();
    });

    it("should work with empty options", () => {
      const agent = new ReviewAgent({});
      expect(agent).toBeDefined();
    });
  });
});
