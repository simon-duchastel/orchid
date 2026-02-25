import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dashboardAction } from './dashboard.js';

const { mockGetStatus } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
}));

vi.mock("../process/manager.js", () => ({
  getStatus: mockGetStatus,
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('dashboard command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show dashboard not available when running', async () => {
    mockGetStatus.mockReturnValue({
      running: true,
      pid: 12345,
    });

    await dashboardAction();

    expect(mockConsoleLog).toHaveBeenCalledWith('Dashboard is not available when running without a web server.');
    expect(mockConsoleLog).toHaveBeenCalledWith('Orchid is running (PID: 12345)');
  });

  it('should exit with code 1 when not running', async () => {
    mockGetStatus.mockReturnValue({
      running: false,
      pid: null,
    });

    await expect(dashboardAction()).rejects.toThrow('process.exit called');

    expect(mockConsoleError).toHaveBeenCalledWith('Orchid is not running. Start it with: orchid up');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
