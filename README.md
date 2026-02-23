![Orchid banner](assets/images/orchid-banner.avif)

## Overview

Orchid helps you orchestrate AI agents in the background. It manages a background daemon that runs an OpenCode server, which allows you to orchestrate many parallel AI tasks in the background. Let your code blossom into a beautiful flower while you sleep!

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

## License

MIT
