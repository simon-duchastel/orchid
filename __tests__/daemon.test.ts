/**
 * Tests for daemon.ts module
 * Tests for the main daemon function with proper mocking
 */

// Mock the @opencode-ai/sdk module
jest.mock('@opencode-ai/sdk', () => ({
  createOpencode: jest.fn(),
}));

// Mock the fs module
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn(),
  dirname: jest.fn(),
}));

// Mock the paths module
jest.mock('../src/paths.js', () => ({
  getPidFile: () => '/mock/.orchid/orchid.pid',
  getLogFile: () => '/mock/.orchid/orchid.log',
  getErrorLogFile: () => '/mock/.orchid/orchid.error.log',
  getDirectoryPort: () => 8080,
  getOrchidDir: () => '/mock/.orchid',
}));

describe('daemon.ts', () => {
  let mockCreateOpencode: jest.Mock;
  let mockWriteFileSync: jest.Mock;
  let mockMkdirSync: jest.Mock;
  let mockExistsSync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCreateOpencode = require('@opencode-ai/sdk').createOpencode;
    mockWriteFileSync = require('fs').writeFileSync;
    mockMkdirSync = require('fs').mkdirSync;
    mockExistsSync = require('fs').existsSync;

    // Default mock implementations
    mockExistsSync.mockReturnValue(false); // Orchid dir doesn't exist
  });

  describe('main function behavior', () => {
    it('should create orchid directory if it does not exist', async () => {
      const mockServer = {
        url: 'http://127.0.0.1:8080',
        close: jest.fn(),
      };
      
      mockCreateOpencode.mockResolvedValue({
        server: mockServer,
      });

      // Import and run the daemon main function
      const { main } = require('../src/daemon');
      
      // Mock console methods to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await main();

      expect(mockMkdirSync).toHaveBeenCalledWith('/mock/.orchid', { recursive: true });
      expect(mockWriteFileSync).toHaveBeenCalledWith('/mock/.orchid/orchid.pid', '123');
      
      consoleSpy.mockRestore();
    });

    it('should not create orchid directory if it already exists', async () => {
      mockExistsSync.mockReturnValue(true); // Orchid dir exists

      const mockServer = {
        url: 'http://127.0.0.1:8080',
        close: jest.fn(),
      };
      
      mockCreateOpencode.mockResolvedValue({
        server: mockServer,
      });

      const { main } = require('../src/daemon');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await main();

      expect(mockMkdirSync).not.toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith('/mock/.orchid/orchid.pid', '123');
      
      consoleSpy.mockRestore();
    });

    it('should create OpenCode server with correct configuration', async () => {
      const mockServer = {
        url: 'http://127.0.0.1:8080',
        close: jest.fn(),
      };
      
      mockCreateOpencode.mockResolvedValue({
        server: mockServer,
      });

      const { main } = require('../src/daemon');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await main();

      expect(mockCreateOpencode).toHaveBeenCalledWith({
        hostname: '127.0.0.1',
        port: 8080,
      });
      
      consoleSpy.mockRestore();
    });

    it('should write PID file with current process ID', async () => {
      const mockServer = {
        url: 'http://127.0.0.1:8080',
        close: jest.fn(),
      };
      
      mockCreateOpencode.mockResolvedValue({
        server: mockServer,
      });

      const { main } = require('../src/daemon');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await main();

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/mock/.orchid/orchid.pid',
        process.pid.toString()
      );
      
      consoleSpy.mockRestore();
    });

    it('should set up signal handlers for graceful shutdown', async () => {
      const mockServer = {
        url: 'http://127.0.0.1:8080',
        close: jest.fn(),
      };
      
      mockCreateOpencode.mockResolvedValue({
        server: mockServer,
      });

      const { main } = require('../src/daemon');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await main();

      // Verify signal handlers are set up by checking they exist
      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
      expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });

    it('should handle OpenCode server creation failure', async () => {
      const error = new Error('Server creation failed');
      mockCreateOpencode.mockRejectedValue(error);

      const { main } = require('../src/daemon');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit() called');
      });

      await expect(main()).rejects.toThrow('process.exit() called');

      expect(consoleSpy).toHaveBeenCalledWith('[orchid] Failed to start daemon:', error);
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('signal handling', () => {
    let mockServer: any;
    let shutdownCallback: ((signal: string) => Promise<void>) | null = null;

    beforeEach(async () => {
      mockServer = {
        url: 'http://127.0.0.1:8080',
        close: jest.fn(),
      };
      
      mockCreateOpencode.mockResolvedValue({
        server: mockServer,
      });

      const { main } = require('../src/daemon');
      jest.spyOn(console, 'log').mockImplementation();

      await main();

      // Capture the shutdown callback
      const sigtermListeners = process.listeners('SIGTERM');
      if (sigtermListeners.length > 0) {
        shutdownCallback = sigtermListeners[sigtermListeners.length - 1] as any;
      }
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle SIGTERM signal gracefully', async () => {
      expect(shutdownCallback).not.toBeNull();
      
      if (shutdownCallback) {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
        
        await shutdownCallback('SIGTERM');

        expect(consoleSpy).toHaveBeenCalledWith('[orchid] Received SIGTERM, shutting down...');
        expect(mockServer.close).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('[orchid] OpenCode server closed');
        expect(processExitSpy).toHaveBeenCalledWith(0);
        
        consoleSpy.mockRestore();
        processExitSpy.mockRestore();
      }
    });

    it('should handle SIGINT signal gracefully', async () => {
      if (shutdownCallback) {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
        
        await shutdownCallback('SIGINT');

        expect(consoleSpy).toHaveBeenCalledWith('[orchid] Received SIGINT, shutting down...');
        expect(mockServer.close).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(0);
        
        consoleSpy.mockRestore();
        processExitSpy.mockRestore();
      }
    });

    it('should handle server close errors gracefully', async () => {
      if (shutdownCallback) {
        const closeError = new Error('Failed to close server');
        mockServer.close.mockImplementation(() => {
          throw closeError;
        });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation();
        
        await shutdownCallback('SIGTERM');

        expect(consoleSpy).toHaveBeenCalledWith('[orchid] Received SIGTERM, shutting down...');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[orchid] Error closing server:', closeError);
        expect(processExitSpy).toHaveBeenCalledWith(0);
        
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
      }
    });
  });
});