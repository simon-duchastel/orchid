# Orchidstrator

A CLI tool for orchestrating complex background AI tasks using the OpenCode SDK.

## Overview

Orchidstrator (`orchid`) manages a background daemon that runs an OpenCode server. This allows you to run AI tasks in the background without blocking your terminal.

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

## Files

- `~/.orchid/orchid.pid` - PID file for tracking the running daemon
- `~/.orchid/orchid.log` - Standard output logs
- `~/.orchid/orchid.error.log` - Error logs

## License

ISC
