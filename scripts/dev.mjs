import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';

await Promise.all([rm('public/sw.js', { force: true }), rm('public/swe-worker.js', { force: true })]);

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack'], { stdio: 'inherit' });

child.on('close', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});