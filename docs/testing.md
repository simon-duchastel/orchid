# Testing

## Overview

Orchid uses **Vitest** as the primary testing framework with comprehensive unit test coverage. Tests are co-located with source files using the `.test.ts` naming convention.

## Testing Stack

- **Test Runner**: Vitest (primary), Jest (secondary support)
- **Coverage**: v8 provider via `@vitest/coverage-v8`
- **Mocking**: Vitest's built-in `vi` mocking utilities
- **Assertions**: Vitest's expect API (Jest-compatible)

## Test Structure

```
src/
├── component.ts           # Source file
├── component.test.ts      # Unit tests (co-located)
├── utils/
│   ├── helper.ts
│   └── helper.test.ts
└── commands/
    ├── command.ts
    └── command.test.ts
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run Jest tests (legacy)
npm run test:jest
```

## Testing Patterns

### 1. Mocking Dependencies

Use `vi.hoisted()` for mock setup and `vi.mock()` for module mocking:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    mockFunction: vi.fn(),
  };
});

vi.mock("./dependency.js", () => ({
  someFunction: mocks.mockFunction,
}));

describe("Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should work correctly", () => {
    mocks.mockFunction.mockReturnValue("test");
    // ... test code
  });
});
```

### 2. Async Testing

Use async/await for async operations:

```typescript
it("should handle async operations", async () => {
  const result = await someAsyncFunction();
  expect(result).toBe(expectedValue);
});
```

### 3. Timer Testing

For code using timers, use fake timers:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("should handle timers", async () => {
  const promise = functionWithTimer();
  await vi.runAllTimersAsync();
  const result = await promise;
  expect(result).toBeDefined();
});
```

### 4. Testing Streams

Mock async generators for stream testing:

```typescript
const streamIterator = (async function* () {
  yield [item1, item2];
  yield [item3];
})();
mocks.mockStreamFunction.mockReturnValue(streamIterator);
```

### 5. Console Output Testing

Capture and verify console output:

```typescript
it("should log messages", () => {
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  
  functionUnderTest();
  
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("expected"));
  consoleSpy.mockRestore();
});
```

### 6. Process Exit Testing

Mock process.exit for CLI tests:

```typescript
const mockExit = vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`process.exit(${code})`);
});

await expect(cliFunction()).rejects.toThrow("process.exit(1)");
expect(mockExit).toHaveBeenCalledWith(1);
```

## Test Utilities

Shared test helpers are available in `test-utils/`:

```typescript
import { TestHelper } from "../test-utils/index.js";

// Create temporary directories
await TestHelper.withTempDirectory(async (dir) => {
  // Test with isolated temp directory
});

// Mock process
const mockProcess = TestHelper.createMockProcess(1234);

// Capture console output
const capture = TestHelper.captureConsole();
// ... run code
expect(capture.logs).toContain(...);
capture.restore();

// Mock process.exit
const exitMock = TestHelper.mockProcessExit();
// ... run code
expect(exitMock.getExitCode()).toBe(1);
exitMock.restore();
```

## Writing Effective Tests

### DO

- **Test behavior, not implementation** - Focus on what the code does
- **Use descriptive test names** - `it("should stop agent when task closes")`
- **Arrange-Act-Assert** - Structure tests clearly
- **Test edge cases** - Empty arrays, null values, errors
- **Mock external dependencies** - File system, network, timers
- **Clean up resources** - Use beforeEach/afterEach for setup/teardown

### DON'T

- **Test internal details** - Don't test private methods directly
- **Create brittle tests** - Avoid hardcoding implementation details
- **Test multiple things** - One assertion per test (usually)
- **Skip cleanup** - Always restore mocks and timers
- **Write tests after code** - Write tests alongside or before implementation

## Example: Complete Test Suite

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MyService } from "./my-service.js";

const mocks = vi.hoisted(() => ({
  mockDbQuery: vi.fn(),
}));

vi.mock("./database.js", () => ({
  query: mocks.mockDbQuery,
}));

describe("MyService", () => {
  let service: MyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MyService();
  });

  describe("getUser", () => {
    it("should return user when found", async () => {
      // Arrange
      const mockUser = { id: "1", name: "Alice" };
      mocks.mockDbQuery.mockResolvedValue([mockUser]);

      // Act
      const result = await service.getUser("1");

      // Assert
      expect(result).toEqual(mockUser);
      expect(mocks.mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        ["1"]
      );
    });

    it("should return null when user not found", async () => {
      mocks.mockDbQuery.mockResolvedValue([]);

      const result = await service.getUser("999");

      expect(result).toBeNull();
    });

    it("should throw on database error", async () => {
      mocks.mockDbQuery.mockRejectedValue(new Error("DB connection failed"));

      await expect(service.getUser("1")).rejects.toThrow(
        "Failed to get user"
      );
    });
  });

  describe("createUser", () => {
    it("should create user with valid data", async () => {
      const input = { name: "Bob", email: "bob@example.com" };
      mocks.mockDbQuery.mockResolvedValue([{ id: "2", ...input }]);

      const result = await service.createUser(input);

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Bob");
    });

    it("should reject invalid email", async () => {
      const input = { name: "Bob", email: "invalid" };

      await expect(service.createUser(input)).rejects.toThrow(
        "Invalid email format"
      );
    });
  });
});
```

## Coverage Goals

- **Unit tests**: 80%+ coverage for all modules
- **Integration tests**: Cover critical paths (daemon lifecycle, agent orchestration)
- **Focus on**: Business logic, error handling, edge cases

## Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Before releases

Run locally before committing:
```bash
npm test && npm run test:coverage
```
