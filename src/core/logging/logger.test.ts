import { describe, it, expect, beforeEach, vi } from "vitest";
import { log, createLogger, setVerboseLogging } from "./index.js";

describe("Logger", () => {
  const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  const mockConsoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const mockConsoleWarn = vi
    .spyOn(console, "warn")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    setVerboseLogging(false);
  });

  describe("default logger (verbose disabled)", () => {
    it("should not log anything when verbose is disabled", () => {
      log.log("test message");
      log.error("test error");
      log.warn("test warning");

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });

  describe("verbose logging enabled", () => {
    it("should log messages when verbose is enabled via setVerboseLogging", () => {
      setVerboseLogging(true);

      log.log("test message");
      expect(mockConsoleLog).toHaveBeenCalledWith("", "test message");

      log.error("test error");
      expect(mockConsoleError).toHaveBeenCalledWith("", "test error");

      log.warn("test warning");
      expect(mockConsoleWarn).toHaveBeenCalledWith("", "test warning");
    });
  });

  describe("createLogger with custom prefix", () => {
    it("should create logger with custom prefix", () => {
      const customLogger = createLogger("TEST", { verbose: true });

      customLogger.log("message");
      expect(mockConsoleLog).toHaveBeenCalledWith("[TEST] ", "message");
    });

    it("should not log when verbose is false even with prefix", () => {
      const customLogger = createLogger("TEST", { verbose: false });

      customLogger.log("message");
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe("logger instance methods", () => {
    it("should set verbose mode dynamically", () => {
      const logger = createLogger("DYNAMIC");

      logger.log("before");
      expect(mockConsoleLog).not.toHaveBeenCalled();

      logger.setVerbose(true);
      logger.log("after");
      expect(mockConsoleLog).toHaveBeenCalledWith("[DYNAMIC] ", "after");
    });

    it("should set prefix dynamically", () => {
      const logger = createLogger("OLD", { verbose: true });
      logger.log("first");
      expect(mockConsoleLog).toHaveBeenCalledWith("[OLD] ", "first");

      logger.setPrefix("NEW");
      logger.log("second");
      expect(mockConsoleLog).toHaveBeenLastCalledWith("[NEW] ", "second");
    });

    it("should handle empty prefix", () => {
      const logger = createLogger("TEST", { verbose: true });
      logger.setPrefix("");
      logger.log("message");
      expect(mockConsoleLog).toHaveBeenCalledWith("", "message");
    });
  });

  describe("LoggerOptions", () => {
    it("should create logger with verbose option", () => {
      const verboseLogger = createLogger("VERBOSE", { verbose: true });
      verboseLogger.log("test");
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it("should create logger without options (defaults to disabled)", () => {
      const defaultLogger = createLogger("DEFAULT");
      defaultLogger.log("test");
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it("should create logger with empty options object", () => {
      const emptyOptsLogger = createLogger("EMPTY", {});
      emptyOptsLogger.log("test");
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });
});
