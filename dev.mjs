import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const nodeExecutable = process.execPath;

const processes = [
  spawn(nodeExecutable, [path.join(rootDir, 'server.js')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(nodeExecutable, [viteBin], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOST: '0.0.0.0',
    },
  }),
];

let shuttingDown = false;

const shutdown = code => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
};

for (const child of processes) {
  child.on('exit', code => {
    if (code !== 0) {
      shutdown(code ?? 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
