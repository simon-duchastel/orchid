import { describe, it, expect } from 'vitest';
import { Command } from '@cliffy/command';
import { generateHelp } from '../help';

describe('generateHelp', () => {
  it('should generate help text', () => {
    const cmd = new Command()
      .name('orchid')
      .description('Test CLI')
      .command('init')
        .description('Initialize orchid workspace')
        .arguments('<repository-url>')
      .command('up')
        .description('Start the orchid daemon')
      .command('down')
        .description('Stop the orchid daemon');

    const helpText = generateHelp(cmd);

    const expected = `Usage: orchid [options] [command]

Test CLI

Commands:
  init <repository-url> Initialize orchid workspace
    <repository-url>    (Required)                 
                                                   
  up                    Start the orchid daemon    
                                                   
  down                  Stop the orchid daemon     `;

    expect(helpText).toBe(expected);
  });

  it('should handle no subcommands', () => {
    const cmd = new Command()
      .name('test')
      .description('Test CLI with no commands')
      .option('-v, --verbose', 'Enable verbose output');

    const helpText = generateHelp(cmd);

    const expected = `Usage: test [options] [command]

Test CLI with no commands`;

    expect(helpText).toBe(expected);
  });
});
