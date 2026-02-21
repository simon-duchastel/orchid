# Best Practices

## Overview

This guide provides practical recommendations for developing with and contributing to Orchid. Following these practices ensures code quality, maintainability, and a consistent development experience.

## Development Workflow

### 1. Before Starting Work

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Verify tests pass
npm test

# Build to check for TypeScript errors
npm run build
```

### 2. During Development

```bash
# Run dev mode with hot reload
npm run dev

# Run tests in watch mode
npm run test:watch

# Check for lint errors (if configured)
npm run lint
```

### 3. Before Committing

```bash
# Run all tests
npm test

# Check coverage
npm run test:coverage

# Build for production
npm run build

# Verify built version works
npm start -- status
```

## Code Patterns

### Handling Async Operations

```typescript
// Always handle errors explicitly
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  // Add context and re-throw
  throw new Error(`Failed to complete operation: ${error.message}`);
}

// Use Promise.all for parallel operations
const [users, posts, comments] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
]);

// Use Promise.allSettled when partial failure is OK
const results = await Promise.allSettled([
  cleanupTask1(),
  cleanupTask2(),
  cleanupTask3(),
]);
```

### Working with Streams

```typescript
// Properly handle stream cancellation
const abortController = new AbortController();

process.on('SIGTERM', () => {
  abortController.abort();
});

for await (const batch of stream) {
  if (abortController.signal.aborted) {
    break;
  }
  await processBatch(batch);
}
```

### Resource Management

```typescript
// Use try-finally for cleanup
async function processTask(task: Task) {
  const worktree = await createWorktree(task.id);
  try {
    await doWork(worktree);
  } finally {
    // Always cleanup, even if doWork fails
    await removeWorktree(worktree);
  }
}

// For multiple resources
async function processWithResources() {
  const resources: Resource[] = [];
  try {
    const r1 = await acquireResource();
    resources.push(r1);
    
    const r2 = await acquireResource();
    resources.push(r2);
    
    return await useResources(resources);
  } finally {
    // Cleanup in reverse order
    for (const resource of resources.reverse()) {
      await releaseResource(resource);
    }
  }
}
```

### Error Handling Patterns

```typescript
// Create specific error types
class TaskExecutionError extends Error {
  constructor(
    message: string,
    public taskId: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'TaskExecutionError';
  }
}

// Use error boundaries
async function runWithErrorHandling<T>(
  fn: () => Promise<T>,
  onError: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return undefined;
  }
}

// Log and continue vs throw
async function nonCriticalOperation() {
  try {
    await updateMetrics();
  } catch (error) {
    // Log but don't fail
    log.warn('Metrics update failed:', error);
  }
}

async function criticalOperation() {
  try {
    await saveToDatabase();
  } catch (error) {
    // Must throw - data integrity at risk
    throw new DatabaseError('Failed to save data', error);
  }
}
```

## Testing Best Practices

### Writing Testable Code

```typescript
// Good - dependencies injected
export class Service {
  constructor(private client: ApiClient) {}
  
  async fetchData(): Promise<Data> {
    return this.client.get('/data');
  }
}

// Bad - hardcoded dependency
export class Service {
  private client = new ApiClient(); // Can't mock!
  
  async fetchData(): Promise<Data> {
    return this.client.get('/data');
  }
}
```

### Test Structure

```typescript
describe('Feature', () => {
  // Setup
  beforeEach(() => {
    // Reset state
  });

  describe('when condition A', () => {
    it('should do X', async () => {
      // Arrange
      const input = createTestInput();
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toEqual(expected);
    });
    
    it('should do Y', async () => {
      // Another test case
    });
  });

  describe('when condition B', () => {
    it('should handle error', async () => {
      // Error case test
    });
  });
});
```

### Mocking Best Practices

```typescript
// Mock at module level
const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock('./api.js', () => ({
  fetchData: mocks.mockFetch,
}));

// Reset between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Restore after test suite
afterEach(() => {
  vi.restoreAllMocks();
});

// Avoid over-mocking - test real behavior where possible
```

## Git Practices

### Commit Messages

Follow conventional commits:

```
feat: add status command with color output
fix: handle port already in use error
docs: update architecture diagram
refactor: simplify agent orchestrator

test: add coverage for worktree creation
chore: update dependencies
```

### Branch Naming

```
feature/add-dashboard-command
fix/port-binding-error
docs/cli-philosophy
refactor/agent-lifecycle
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run full test suite
4. Push branch and create PR
5. Request review
6. Merge after approval

## Debugging

### Development Mode

```bash
# Run with verbose logging
npm run dev -- --verbose

# Or
orchid up --verbose
```

### Inspecting the Daemon

```bash
# Check if daemon is running
orchid status

# View daemon logs
ps aux | grep orchid
lsof -p <pid>  # See open files
```

### Debugging Tests

```bash
# Run specific test
npm test -- agent-orchestrator

# Run with debugger
node --inspect-brk node_modules/.bin/vitest run

# Or use VS Code debugger
```

### Common Issues

**Port already in use:**
```bash
# Find process using port
lsof -i :4096

# Kill process
kill -9 <pid>
```

**Orphaned worktrees:**
```bash
# List worktrees
git worktree list

# Remove stale worktrees
git worktree prune
```

## Performance Guidelines

### Efficient Patterns

```typescript
// Use sets for lookups
const taskIds = new Set(tasks.map(t => t.id));
if (taskIds.has(id)) { ... }  // O(1) vs O(n)

// Batch operations
const batches = chunk(items, 10);
for (const batch of batches) {
  await Promise.all(batch.map(process));
}

// Stream large datasets
for await (const item of largeDataset) {
  await process(item);
}
```

### Memory Management

```typescript
// Avoid memory leaks in event handlers
const abortController = new AbortController();

// Cleanup event listeners
process.removeListener('SIGTERM', handler);

// Don't accumulate large arrays
for (const item of stream) {
  await process(item); // Process one at a time
}
```

## Security Best Practices

### Never Log Sensitive Data

```typescript
// Bad - credentials in logs
log.info('Connecting with password:', password);

// Good - redact sensitive data
log.info('Connecting to server...');
// Credentials handled internally
```

### Validate All Inputs

```typescript
function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }
}

function sanitizePath(input: string): string {
  // Prevent path traversal
  return path.normalize(input).replace(/^(\.\.[\/\\])+/, '');
}
```

### Environment Variables

```typescript
// Use strict typing
interface Env {
  OPENCODE_SERVER_PASSWORD: string;
  OPENCODE_SERVER_USERNAME?: string;
}

// Validate at startup
function validateEnv(): void {
  if (!process.env.OPENCODE_SERVER_PASSWORD) {
    throw new Error('OPENCODE_SERVER_PASSWORD is required');
  }
}
```

## Code Review Checklist

When reviewing code:

- [ ] **Functionality** - Does it work as intended?
- [ ] **Tests** - Are there adequate tests?
- [ ] **Error Handling** - Are edge cases handled?
- [ ] **Performance** - Any obvious performance issues?
- [ ] **Security** - Any security concerns?
- [ ] **Documentation** - Is code documented?
- [ ] **Style** - Follows code principles?
- [ ] **Cleanup** - Resources properly released?

## Documentation

### When to Document

- Public APIs and interfaces
- Complex business logic
- Non-obvious workarounds
- Architecture decisions

### Where to Document

- **Code comments** - Implementation details
- **JSDoc** - Public API documentation
- **docs/** - High-level concepts and guides
- **README** - Quick start and overview
- **ADR/** - Architecture Decision Records (future)

## Continuous Improvement

- **Regular refactors** - Keep codebase healthy
- **Update dependencies** - Security and features
- **Review practices** - Update this document
- **Share knowledge** - Document lessons learned
