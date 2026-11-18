import { spawn } from 'node:child_process';
import which from 'which';
import type { AgentAdapter, AgentDetectionResult } from '@contribpilot/shared';

export interface LaunchOptions {
  cwd: string;
  planFile: string;
  prompt: string;
}

/**
 * Sanitizes arguments passed to child_process to prevent
 * "The command and its arguments cannot contain a line break on Windows without a shell" (CVE-2024-27980).
 */
export function sanitizeCliArg(arg: string): string {
  return arg.replace(/[\r\n]+/g, ' ').trim();
}

export interface RunProcessOptions {
  cwd?: string;
  timeout?: number;
  stdio?: 'inherit' | 'pipe';
}

/**
 * Executes a subprocess safely across Windows, macOS, and Linux
 * using Node's standard child_process module, avoiding third-party
 * dependency incompatibility across Node versions (e.g. Node 20 vs 22).
 */
export function runProcess(
  bin: string,
  args: string[],
  options: RunProcessOptions = {}
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const isCmdOrBat =
      isWindows && (bin.toLowerCase().endsWith('.cmd') || bin.toLowerCase().endsWith('.bat'));

    let timer: NodeJS.Timeout | undefined;
    const child = spawn(bin, args, {
      cwd: options.cwd,
      stdio: options.stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'ignore'],
      shell: isCmdOrBat,
      windowsHide: true,
    });

    if (options.timeout && options.timeout > 0) {
      timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore kill errors
        }
        reject(new Error(`Process timed out after ${options.timeout}ms: ${bin}`));
      }, options.timeout);
    }

    let stdout = '';
    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
    }

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0 || options.stdio === 'inherit') {
        resolve({ stdout });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${bin}`));
      }
    });
  });
}

export abstract class BaseAgentAdapter implements AgentAdapter {
  abstract id: string;
  abstract displayName: string;
  abstract candidateBinaries: string[];
  resolvedPath?: string;

  async detect(): Promise<AgentDetectionResult> {
    for (const bin of this.candidateBinaries) {
      try {
        const binPath = await which(bin, { nothrow: true });
        if (binPath) {
          this.resolvedPath = binPath;
          try {
            const { stdout } = await runProcess(binPath, ['--version'], { timeout: 3000 });
            const firstLine = stdout.trim().split('\n')[0] || '';
            return { installed: true, path: binPath, version: firstLine };
          } catch {
            return { installed: true, path: binPath };
          }
        }
      } catch {
        // Continue checking other candidate binaries
      }
    }
    return { installed: false };
  }

  abstract launch(opts: LaunchOptions): Promise<void>;
}

export class ClaudeCodeAdapter extends BaseAgentAdapter {
  id = 'claude';
  displayName = 'Claude Code';
  candidateBinaries = ['claude', 'claude.cmd', 'claude.exe'];

  async launch(opts: LaunchOptions): Promise<void> {
    const bin = this.resolvedPath || 'claude';
    const promptClean = sanitizeCliArg(opts.prompt);
    const planClean = sanitizeCliArg(opts.planFile);
    const initialPrompt = `${promptClean} (Contribution Plan: ${planClean})`;
    await runProcess(bin, [initialPrompt], {
      cwd: opts.cwd,
      stdio: 'inherit',
    });
  }
}

export class GeminiCLIAdapter extends BaseAgentAdapter {
  id = 'gemini';
  displayName = 'Gemini CLI';
  candidateBinaries = ['gemini', 'gemini.cmd', 'gemini.exe'];

  async launch(opts: LaunchOptions): Promise<void> {
    const bin = this.resolvedPath || 'gemini';
    const promptClean = sanitizeCliArg(opts.prompt);
    const planClean = sanitizeCliArg(opts.planFile);
    const initialPrompt = `${promptClean} (Contribution Plan: ${planClean})`;
    await runProcess(bin, ['-i', initialPrompt], {
      cwd: opts.cwd,
      stdio: 'inherit',
    });
  }
}

export class OpenCodeAdapter extends BaseAgentAdapter {
  id = 'opencode';
  displayName = 'OpenCode';
  candidateBinaries = ['opencode', 'opencode.cmd', 'opencode.exe'];

  async launch(opts: LaunchOptions): Promise<void> {
    const bin = this.resolvedPath || 'opencode';
    await runProcess(bin, [sanitizeCliArg(opts.planFile)], {
      cwd: opts.cwd,
      stdio: 'inherit',
    });
  }
}

export class AiderAdapter extends BaseAgentAdapter {
  id = 'aider';
  displayName = 'Aider';
  candidateBinaries = ['aider', 'aider.exe'];

  async launch(opts: LaunchOptions): Promise<void> {
    const bin = this.resolvedPath || 'aider';
    await runProcess(
      bin,
      ['--message', sanitizeCliArg(opts.prompt), sanitizeCliArg(opts.planFile)],
      {
        cwd: opts.cwd,
        stdio: 'inherit',
      }
    );
  }
}

export class CodexAdapter extends BaseAgentAdapter {
  id = 'codex';
  displayName = 'OpenAI Codex';
  candidateBinaries = ['codex', 'codex.exe'];

  async launch(opts: LaunchOptions): Promise<void> {
    const bin = this.resolvedPath || 'codex';
    await runProcess(bin, [sanitizeCliArg(opts.prompt)], {
      cwd: opts.cwd,
      stdio: 'inherit',
    });
  }
}

export class CursorAgentAdapter extends BaseAgentAdapter {
  id = 'cursor';
  displayName = 'Cursor';
  candidateBinaries = ['cursor', 'cursor.cmd', 'cursor.exe', 'cursor-agent'];

  async launch(opts: LaunchOptions): Promise<void> {
    const bin = this.resolvedPath || 'cursor';
    // Opens the repository folder and the plan file directly inside Cursor
    await runProcess(bin, [sanitizeCliArg(opts.cwd), sanitizeCliArg(opts.planFile)], {
      cwd: opts.cwd,
      stdio: 'inherit',
    });
  }
}

export class VSCodeAdapter extends BaseAgentAdapter {
  id = 'code';
  displayName = 'Visual Studio Code';
  candidateBinaries = ['code', 'code.cmd', 'code.exe'];

  async launch(opts: LaunchOptions): Promise<void> {
    const bin = this.resolvedPath || 'code';
    // Opens the repository folder and the plan file directly inside VS Code
    await runProcess(bin, [sanitizeCliArg(opts.cwd), sanitizeCliArg(opts.planFile)], {
      cwd: opts.cwd,
      stdio: 'inherit',
    });
  }
}

export class AgentDetector {
  private adapters: BaseAgentAdapter[] = [
    new ClaudeCodeAdapter(),
    new GeminiCLIAdapter(),
    new OpenCodeAdapter(),
    new CursorAgentAdapter(),
    new VSCodeAdapter(),
    new AiderAdapter(),
    new CodexAdapter(),
  ];

  async getInstalledAgents(): Promise<{ adapter: AgentAdapter; result: AgentDetectionResult }[]> {
    const detected: { adapter: AgentAdapter; result: AgentDetectionResult }[] = [];
    for (const adapter of this.adapters) {
      const result = await adapter.detect();
      if (result.installed) {
        detected.push({ adapter, result });
      }
    }
    return detected;
  }

  getAdapter(id: string): AgentAdapter | undefined {
    return this.adapters.find((a) => a.id === id);
  }

  getAllAdapters(): AgentAdapter[] {
    return [...this.adapters];
  }
}

export const defaultAgentDetector = new AgentDetector();
