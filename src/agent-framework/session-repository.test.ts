import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmdirSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { SessionRepository, AgentType, createSessionRepository } from "./session-repository.js";

const TEST_DIR = "/tmp/orchid-session-repo-test";

describe("SessionRepository", () => {
  let repository: SessionRepository;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      const files = readdirSync(TEST_DIR);
      for (const file of files) {
        const filePath = join(TEST_DIR, file);
        if (existsSync(filePath)) {
          const stats = readdirSync(filePath);
          for (const innerFile of stats) {
            unlinkSync(join(filePath, innerFile));
          }
          rmdirSync(filePath);
        }
      }
      rmdirSync(TEST_DIR);
    }

    repository = createSessionRepository({ sessionsDir: TEST_DIR });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      const files = readdirSync(TEST_DIR);
      for (const file of files) {
        const filePath = join(TEST_DIR, file);
        if (existsSync(filePath)) {
          const innerFiles = readdirSync(filePath);
          for (const innerFile of innerFiles) {
            unlinkSync(join(filePath, innerFile));
          }
          rmdirSync(filePath);
        }
      }
      rmdirSync(TEST_DIR);
    }
  });

  describe("constructor", () => {
    it("should create sessions directory if it does not exist", () => {
      const testDir = "/tmp/orchid-session-repo-new";
      
      if (existsSync(testDir)) {
        rmdirSync(testDir);
      }

      expect(existsSync(testDir)).toBe(false);
      
      createSessionRepository({ sessionsDir: testDir });
      
      expect(existsSync(testDir)).toBe(true);
      
      // Cleanup
      rmdirSync(testDir);
    });
  });

  describe("getOrCreateSession", () => {
    it("should create a new session when none exists", () => {
      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.taskId).toBe("task-1");
      expect(session.agentType).toBe(AgentType.IMPLEMENTOR);
      expect(session.version).toBe(1);
      expect(session.filename).toBe("implementor-1");
      expect(session.filePath).toBe(join(TEST_DIR, "task-1", "implementor-1.json"));
    });

    it("should create different sessions for different agent types", () => {
      const implementorSession = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);
      const reviewerSession = repository.getOrCreateSession("task-1", AgentType.REVIEWER);
      const mergerSession = repository.getOrCreateSession("task-1", AgentType.MERGER);

      expect(implementorSession.agentType).toBe(AgentType.IMPLEMENTOR);
      expect(implementorSession.version).toBe(1);

      expect(reviewerSession.agentType).toBe(AgentType.REVIEWER);
      expect(reviewerSession.version).toBe(1);

      expect(mergerSession.agentType).toBe(AgentType.MERGER);
      expect(mergerSession.version).toBe(1);
    });

    it("should return existing session if one exists", () => {
      // Create the session file
      const taskDir = join(TEST_DIR, "task-1");
      mkdirSync(taskDir, { recursive: true });
      const sessionFile = join(taskDir, "implementor-1.json");
      
      // Create an empty file to simulate existing session
      const fd = require("node:fs").openSync(sessionFile, "w");
      require("node:fs").closeSync(fd);

      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.taskId).toBe("task-1");
      expect(session.agentType).toBe(AgentType.IMPLEMENTOR);
      expect(session.version).toBe(1);
    });

    it("should return the latest version if multiple exist", () => {
      // Create multiple session files
      const taskDir = join(TEST_DIR, "task-1");
      mkdirSync(taskDir, { recursive: true });
      
      // Create session files for different versions
      for (const version of [1, 2, 3]) {
        const sessionFile = join(taskDir, `implementor-${version}.json`);
        const fd = require("node:fs").openSync(sessionFile, "w");
        require("node:fs").closeSync(fd);
      }

      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.version).toBe(3);
    });

    it("should handle different tasks independently", () => {
      const session1 = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);
      const session2 = repository.getOrCreateSession("task-2", AgentType.IMPLEMENTOR);

      expect(session1.taskId).toBe("task-1");
      expect(session2.taskId).toBe("task-2");
      expect(session1.filePath).not.toBe(session2.filePath);
    });
  });

  describe("getTaskSessionsDir", () => {
    it("should return the correct path for task sessions", () => {
      const path = repository.getTaskSessionsDir("task-1");
      expect(path).toBe(join(TEST_DIR, "task-1"));
    });
  });

  describe("Session", () => {
    it("should expose correct properties", () => {
      const session = repository.getOrCreateSession("task-1", AgentType.REVIEWER);

      expect(session.taskId).toBe("task-1");
      expect(session.agentType).toBe(AgentType.REVIEWER);
      expect(session.version).toBe(1);
      expect(session.filename).toBe("reviewer-1");
      expect(session.filePath).toContain("reviewer-1.json");
    });
  });
});
