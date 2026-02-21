# CLI Philosophy

## Overview

Orchid follows the Unix philosophy and modern CLI design principles to provide a powerful yet intuitive interface for orchestrating AI agents.

## Core Principles

### 1. Simplicity First

The CLI should be simple to use for basic tasks while remaining powerful for advanced use cases.

```bash
# Simple - just works
orchid up

# Advanced - when you need control
orchid up --port 5000 --verbose
```

### 2. Convention over Configuration

Sensible defaults that work out of the box.

```bash
# Works without configuration
orchid up

# Customizable when needed
orchid init --template custom
```

### 3. Clear Feedback

Users should always know what's happening.

**Good:**
```
$ orchid up
[orchid] Starting daemon (PID: 1234)
[orchid] OpenCode server running at http://127.0.0.1:4096
[orchid] Agent orchestrator started
[orchid] Daemon ready
```

**Bad:**
```
$ orchid up
# No output - user wonders if it worked
```

### 4. Idempotency

Running a command multiple times should have the same effect as running it once.

```bash
# First time - starts daemon
$ orchid up
Starting daemon...

# Second time - already running
$ orchid up
Daemon is already running (PID: 1234)

# Stop is also idempotent
$ orchid down
Stopping daemon...
$ orchid down
Daemon is not running
```

### 5. Graceful Degradation

Fail gracefully with helpful error messages.

```bash
$ orchid status
Daemon is not running

To start the daemon, run:
  orchid up

$ orchid dashboard
Error: Daemon is not running. Start it with 'orchid up' first.
```

## Command Design

### Command Structure

```
orchid <command> [options] [arguments]
```

### Commands

| Command | Description | Philosophy |
|---------|-------------|------------|
| `init` | Initialize a project | Setup should be explicit and guided |
| `up` | Start daemon | Simple action, clear feedback |
| `down` | Stop daemon | Graceful shutdown, cleanup |
| `status` | Check daemon status | Always informative |
| `dashboard` | Open web dashboard | Bridge CLI and web |

### Options

- **Global options** affect all commands (`--verbose`, `--help`)
- **Command options** are specific to the command
- **Boolean flags** don't take values (`--force` not `--force=true`)
- **String options** use equals or space (`--port=5000` or `--port 5000`)

## Output Conventions

### Progress Indicators

Show progress for long-running operations:

```
$ orchid up --verbose
[orchid] Starting daemon...
[orchid] Finding available port... ✓
[orchid] Starting OpenCode server... ✓
[orchid] Initializing orchestrator... ✓
[orchid] Daemon ready (PID: 1234)
```

### Error Messages

1. State what happened
2. Explain why (if helpful)
3. Provide next steps

```
Error: Failed to start daemon on port 4096

Reason: Port 4096 is already in use by process 5678.

To fix this, you can:
  1. Stop the other process, or
  2. Use a different port: orchid up --port 5000
```

### Success Messages

Concise and actionable:

```
$ orchid up
Daemon started successfully (PID: 1234)
Server running at http://127.0.0.1:4096

$ orchid down
Daemon stopped successfully
```

## Daemon Model

Orchid uses a daemon-based architecture for background operation:

### Why a Daemon?

1. **Background Operation** - Tasks run without blocking the terminal
2. **Persistence** - Survives terminal closure
3. **State Management** - Maintains long-running connections
4. **Resource Sharing** - Single server for multiple agents

### Daemon Lifecycle

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐
│  CLI    │───▶│ Process  │───▶│ Daemon  │───▶│ Server   │
│ Command │    │ Manager  │    │ Process │    │ Instance │
└─────────┘    └──────────┘    └─────────┘    └──────────┘
                                   │
                                   ▼
                              ┌──────────┐
                              │ Agents   │
                              └──────────┘
```

### Process Management

- **PID Files** - Track running daemon
- **Graceful Shutdown** - SIGTERM/SIGINT handling
- **Auto-cleanup** - Remove worktrees on stop

## Configuration

### Environment Variables

Orchid uses environment variables for configuration:

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENCODE_SERVER_PASSWORD` | Server authentication | (required) |
| `OPENCODE_SERVER_USERNAME` | Server username | `opencode` |

### No Config Files (by design)

Orchid intentionally avoids config files for simplicity:

- **Convention-based** - Sensible defaults
- **Environment variables** - For sensitive/configurable data
- **CLI options** - For per-command customization

## Security

### Authentication

- Server requires basic authentication
- Credentials passed via environment variables
- Never logged or exposed

### Isolation

- Each task runs in isolated Git worktree
- No shared state between agents
- Resource limits per agent (future)

## Help System

### Built-in Help

Every command includes help:

```bash
orchid --help
orchid up --help
orchid init --help
```

### Man Pages

Future: comprehensive man pages for each command.

## Future CLI Enhancements

- [ ] Shell completions (bash, zsh, fish)
- [ ] Configuration file support (opt-in)
- [ ] Plugins/extensions
- [ ] REST API for programmatic access
- [ ] Web dashboard integration
- [ ] Log streaming: `orchid logs --follow`
