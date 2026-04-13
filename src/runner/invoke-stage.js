'use strict';

const { spawnSync } = require('node:child_process');

const EXECUTION_MODEL = 'spawn-sync-explicit';

function invokeStage(options) {
  const { command, args = [], cwd, env } = options || {};
  if (!command || typeof command !== 'string') {
    throw new Error('invokeStage: command is required');
  }
  if (!Array.isArray(args)) {
    throw new Error('invokeStage: args must be an array');
  }

  const result = spawnSync(command, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

module.exports = {
  invokeStage,
  EXECUTION_MODEL,
};
