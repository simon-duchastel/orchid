# Code Principles

## Overview

This document outlines the architectural patterns, coding standards, and design principles used in the Orchid codebase. Following these principles ensures consistency, maintainability, and testability.

## Core Principles

### 1. Single Responsibility

Each module, class, and function should have one reason to change.

**Good:**
```typescript
// process-manager.ts - Only handles process lifecycle
export async function startDaemon(): Promise<ProcessResult> { ... }
export async function stopDaemon(): Promise<void> { ... }

// worktrees/manager.ts - Only handles Git worktrees
export class WorktreeManager { ... }
```

**Bad:**
```typescript
// Don't mix concerns
class GodClass {
  startDaemon() { ... }
  createWorktree() { ... }
  manageSessions() { ... }
}
```

### 2. Dependency Injection

Pass dependencies through constructors or parameters to enable testing and flexibility.

**Good:**
```typescript
export class AgentOrchestrator {
  constructor(options: AgentOrchestratorOptions) {
    this.worktreeManager = options.worktreeManager ?? new WorktreeManager();
    this.sessionManager = options.sessionManager ?? new OpencodeSessionManager();
  }
}

// Test can inject mocks
const orchestrator = new AgentOrchestrator({
  worktreeManager: mockWorktreeManager,
  sessionManager: mockSessionManager,
  opencodeBaseUrl: "http://localhost:4096",
});
```

### 3. Explicit over Implicit

Prefer explicit configuration over magical defaults.

**Good:**
```typescript
export interface CreateWorktreeOptions {
  force?: boolean;
  detach?: boolean;
}

await worktreeManager.create(path, "HEAD", { detach: true });
```

**Bad:**
```typescript
// Unclear what flags are being used
await createWorktree(path); // Magic behavior
```

### 4. Fail Fast, Fail Clearly

Validate inputs early and provide clear error messages.

**Good:**
```typescript
async function createOpencodeServer(config: OpencodeServerConfig): Promise<OpencodeServerInstance> {
  if (!config.startPort) {
    throw new Error("startPort is required");
  }
  
  const port = await findAvailablePort(config.startPort, hostname, maxAttempts);
  
  if (!port) {
    throw new Error(`No available port found between ${config.startPort} and ${config.startPort + maxAttempts}`);
  }
  
  // ... continue
}
```

### 5. Resource Cleanup

Always clean up resources, even when errors occur.

**Good:**
```typescript
try {
  await worktreeManager.create(path, ref);
  await sessionManager.createSession(taskId);
} catch (error) {
  // Clean up on failure
  await worktreeManager.remove(path, { force: true });
  throw error;
}
```

## TypeScript Conventions

### Module System

- Use ES modules (`"type": "module"` in package.json)
- Import with `.js` extension: `import { foo } from "./bar.js"`
- Use `node:` prefix for Node.js built-ins: `import { readFile } from "node:fs/promises"`

### Type Safety

- Enable `strict: true` in tsconfig.json
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions
- Avoid `any` - use `unknown` with type guards instead

```typescript
// Good
export interface ServerConfig {
  port: number;
  hostname: string;
}

export function createServer(config: ServerConfig): ServerInstance {
  // ...
}

// Bad
function createServer(config: any): any { ... }
```

### Naming Conventions

- **Files**: kebab-case.ts (e.g., `process-manager.ts`)
- **Classes**: PascalCase (e.g., `AgentOrchestrator`)
- **Interfaces**: PascalCase (e.g., `ServerConfig`)
- **Functions**: camelCase (e.g., `startDaemon`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g., `MAX_RETRY_ATTEMPTS`)
- **Private members**: Leading underscore (e.g., `_internalState`)

### Async Patterns

- Prefer `async/await` over raw promises
- Use async generators for streams: `async function* streamTasks()`
- Always await promises before catching errors

```typescript
// Good
async function fetchData(): Promise<Data> {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch: ${error.message}`);
  }
}

// Bad
function fetchData(): Promise<Data> {
  return fetch(url)
    .then(r => r.json())
    .catch(e => { throw e; });
}
```

## Error Handling

### Custom Error Types

Create specific error types for domain errors:

```typescript
export class WorktreeError extends Error {
  constructor(message: string, public path: string) {
    super(message);
    this.name = "WorktreeError";
  }
}
```

### Error Propagation

- Let errors bubble up to the appropriate handler
- Add context at each level
- Don't swallow errors silently

```typescript
// Good
try {
  await worktreeManager.create(path, ref);
} catch (error) {
  // Add context and re-throw
  throw new Error(`Failed to setup worktree for task ${taskId}: ${error.message}`);
}

// Bad - swallowing errors
try {
  await riskyOperation();
} catch (e) {
  // Error lost!
  console.log("Something went wrong");
}
```

## Code Organization

### File Structure

```
src/
├── cli/
│   ├── commands/           # CLI command implementations
│   │   ├── init.ts
│   │   ├── up.ts
│   │   └── ...
│   └── index.ts           # Command exports
├── worktrees/             # Feature module
│   ├── manager.ts         # Main class
│   ├── types.ts           # Interfaces/types
│   └── index.ts           # Public API
├── utils/                 # Utilities
│   ├── logger.ts
│   ├── networking.ts
│   └── credentials.ts
├── daemon.ts              # Main daemon entry
├── agent-orchestrator.ts  # Core orchestration
├── opencode-server.ts     # Server management
└── opencode-session.ts    # Session management
```

### Module Exports

- Use `index.ts` for public API
- Keep implementation details private
- Export types alongside implementations

```typescript
// worktrees/index.ts
export { WorktreeManager } from "./manager.js";
export type { WorktreeInfo, CreateWorktreeOptions } from "./types.js";

// Private implementation stays in manager.ts
```

## Documentation

### JSDoc Comments

Use JSDoc for public APIs:

```typescript
/**
 * Create and start a new OpenCode server instance.
 *
 * This function will:
 * 1. Find an available port starting from the provided startPort
 * 2. Start the OpenCode server
 *
 * @param config - Server configuration
 * @returns Promise that resolves to the server instance
 * @throws Error if no available port is found or server fails to start
 */
export async function createOpencodeServer(
  config: OpencodeServerConfig
): Promise<OpencodeServerInstance> { ... }
```

### Inline Comments

Explain the "why", not the "what":

```typescript
// Good - explains why
// Wait for stream to complete before checking results
await vi.runAllTimersAsync();

// Bad - restates the obvious
// Call runAllTimersAsync function
await vi.runAllTimersAsync();
```

## Performance Considerations

### Lazy Loading

Load expensive dependencies only when needed:

```typescript
// Good
async function heavyOperation() {
  const { expensiveLib } = await import("expensive-lib");
  return expensiveLib.process();
}
```

### Streaming

Use streams for large datasets:

```typescript
// Good - memory efficient
for await (const batch of taskStream) {
  await processBatch(batch);
}

// Bad - loads everything into memory
const allTasks = await loadAllTasks();
```

## Testing Principles

See [Testing](./testing.md) for detailed testing guidelines. Key points:

- Write tests alongside code
- Mock external dependencies
- Test behavior, not implementation
- Maintain >80% coverage

## Review Checklist

Before submitting code:

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Code follows naming conventions
- [ ] Error handling is comprehensive
- [ ] Resource cleanup is handled
- [ ] Public APIs are documented
- [ ] No `console.log` in production code (use `logger.ts`)
- [ ] No `any` types without justification
