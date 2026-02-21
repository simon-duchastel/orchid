# System Architecture

## Overview

Orchid is a Node.js/TypeScript application that orchestrates AI agents through a background daemon. The architecture follows a layered design with clear separation of concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          CLI Layer                           │
│  (commands: init, up, down, status, dashboard)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Process Manager                          │
│  (spawns daemon, manages PID files, process lifecycle)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Daemon Process                        │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │  OpenCode Server │  │     Agent Orchestrator       │    │
│  │  (HTTP server)   │──▶│  (monitors tasks, manages    │    │
│  │                  │  │   agent lifecycle)           │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Agent Infrastructure                  │
│  ┌────────────────┐  ┌──────────────────────────────────┐  │
│  │  Git Worktrees │  │      OpenCode Sessions           │  │
│  │  (isolated     │  │  (communicate with AI agents)    │  │
│  │   task dirs)   │  │                                  │  │
│  └────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. CLI Layer (`src/cli/`)

The command-line interface built with [Cliffy](https://cliffy.io/). Provides commands:

- `init` - Initialize a project for orchid
- `up` - Start the daemon
- `down` - Stop the daemon
- `status` - Check daemon status
- `dashboard` - Open the web dashboard

**Key Files:**
- `src/cli.ts` - Main CLI entry point
- `src/cli/commands/*.ts` - Individual command implementations

### 2. Process Manager (`src/process-manager.ts`)

Manages the daemon process lifecycle:
- Spawns the daemon as a detached background process
- Creates and manages PID files
- Handles graceful shutdown

### 3. Daemon (`src/daemon.ts`)

The background process that:
- Starts and manages the OpenCode server
- Initializes the Agent Orchestrator
- Handles SIGTERM/SIGINT for graceful shutdown

### 4. OpenCode Server (`src/opencode-server.ts`)

Manages the OpenCode SDK server instance:
- Dynamic port allocation
- Server lifecycle (start/stop)
- Authentication configuration

### 5. Agent Orchestrator (`src/agent-orchestrator.ts`)

The core orchestration logic:
- Monitors task stream from Dyson Swarm
- Creates implementor agents for open tasks
- Manages agent lifecycle (start/stop)
- Coordinates worktree creation and session management

### 6. Git Worktrees (`src/worktrees/`)

Isolated Git worktree management:
- Creates detached worktrees for each task
- Manages worktree lifecycle
- Prevents conflicts between concurrent tasks

### 7. OpenCode Sessions (`src/opencode-session.ts`)

Manages OpenCode SDK sessions:
- Creates sessions for agents
- Sends prompt messages
- Session lifecycle management

## Data Flow

### Starting the System

1. User runs `orchid up`
2. CLI calls `startDaemon()` from process manager
3. Process manager spawns `daemon.ts` as detached process
4. Daemon creates OpenCode server with dynamic port
5. Daemon initializes AgentOrchestrator
6. Orchestrator connects to Dyson Swarm task stream

### Task Execution Flow

1. Dyson Swarm publishes new "open" task
2. AgentOrchestrator receives task via stream
3. Orchestrator creates Git worktree for task
4. Orchestrator creates OpenCode session
5. Orchestrator sends initial prompt to session
6. Agent processes task in isolated worktree
7. When task closes, orchestrator cleans up resources

## Directory Structure

```
~/.orchid/                    # Orchid home directory
├── pid                       # Daemon PID file
└── worktrees/                # Task worktrees
    ├── task-1/              # Worktree for task-1
    └── task-2/              # Worktree for task-2
```

## Dependencies

### External Dependencies

- **@opencode-ai/sdk** - OpenCode server and session management
- **dyson-swarm** - Task management and streaming
- **@cliffy/command** - CLI framework
- **simple-git** - Git operations

### Internal Dependencies

Components communicate through well-defined interfaces:
- `AgentOrchestrator` uses `WorktreeManager` and `OpencodeSessionManager`
- Commands use `ProcessManager` for daemon control
- Server creation is abstracted behind `createOpencodeServer()`

## Design Principles

1. **Separation of Concerns** - Each component has a single responsibility
2. **Dependency Injection** - Components accept dependencies for testability
3. **Graceful Degradation** - Errors in one area don't crash the system
4. **Resource Cleanup** - Always clean up worktrees and sessions on stop
5. **Async Streams** - Use async generators for task monitoring

## Future Considerations

- Plugin architecture for custom agent types
- Task queue persistence for crash recovery
- Multi-repo support
- REST API for external integrations
