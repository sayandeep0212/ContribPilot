import { describe, it, expect } from 'vitest';
import {
  sanitizeCliArg,
  defaultAgentDetector,
  ClaudeCodeAdapter,
  GeminiCLIAdapter,
  CursorAgentAdapter,
  runProcess,
} from '../src/index.js';

describe('@contribpilot/handoff', () => {
  describe('sanitizeCliArg', () => {
    it('removes newlines and carriage returns to prevent command injection', () => {
      const dangerous = 'hello\r\nworld\nmalicious;rm -rf';
      const clean = sanitizeCliArg(dangerous);
      expect(clean).not.toContain('\r');
      expect(clean).not.toContain('\n');
      expect(clean).toBe('hello world malicious;rm -rf');
    });

    it('trims leading and trailing whitespace', () => {
      expect(sanitizeCliArg('   foo bar   ')).toBe('foo bar');
    });
  });

  describe('AgentDetector & Adapters', () => {
    it('initializes defaultAgentDetector with registered adapters', () => {
      const all = defaultAgentDetector.getAllAdapters();
      expect(all.length).toBeGreaterThanOrEqual(7);

      const claude = defaultAgentDetector.getAdapter('claude');
      expect(claude).toBeDefined();
      expect(claude?.displayName).toBe('Claude Code');

      const gemini = defaultAgentDetector.getAdapter('gemini');
      expect(gemini).toBeDefined();
      expect(gemini?.displayName).toBe('Gemini CLI');

      const cursor = defaultAgentDetector.getAdapter('cursor');
      expect(cursor).toBeDefined();
      expect(cursor?.displayName).toBe('Cursor');
    });

    it('returns false for non-existent binary detection without throwing', async () => {
      const adapter = new ClaudeCodeAdapter();
      adapter.candidateBinaries = ['__definitely_non_existent_binary_12345__'];
      const result = await adapter.detect();
      expect(result.installed).toBe(false);
    });
  });

  describe('runProcess', () => {
    it('executes a standard node command and captures stdout', async () => {
      const res = await runProcess(process.execPath, ['-e', 'console.log("handoff-test-ok")']);
      expect(res.stdout.trim()).toBe('handoff-test-ok');
    });

    it('handles process errors cleanly', async () => {
      await expect(runProcess('__non_existent_binary_98765__', [])).rejects.toThrow();
    });

    it('times out if process exceeds timeout limit', async () => {
      await expect(
        runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 2000)'], { timeout: 100 })
      ).rejects.toThrow(/timed out/i);
    });
  });
});
