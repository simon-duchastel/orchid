# Orchid

> **Orchid** helps you orchidstrate (like orchestrate) AI agents in the background.


## Overview

Orchid (`orchid`) manages a background daemon that runs an OpenCode server. This allows you to orchestrate AI tasks in the background without blocking your terminal.

## Installation

```bash
npm install
npm run build
npm link  # Makes 'orchid' command available globally
```

## Usage

### Start the daemon

```bash
orchid up
```

Starts the orchid daemon and OpenCode server in the background. The server runs at `http://127.0.0.1:4096` by default.

### Check status

```bash
orchid status
```

Shows whether the daemon is running and its PID.

### Stop the daemon

```bash
orchid down
```

Gracefully stops the daemon and OpenCode server.

## Development

```bash
# Run in development mode (using tsx)
npm run dev

# Build for production
npm run build

# Run the built version
npm start
```

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Architecture](./docs/architecture.md)** - System design and component interactions
- **[Testing](./docs/testing.md)** - Testing strategies and patterns
- **[Code Principles](./docs/code-principles.md)** - Coding standards and design patterns
- **[CLI Philosophy](./docs/cli-philosophy.md)** - CLI design principles
- **[Best Practices](./docs/best-practices.md)** - Development guidelines

## License

MIT
