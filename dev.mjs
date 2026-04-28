import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const nodeExecutable = process.execPath;

const findFreePort = startPort => new Promise(resolve => {
  const tryPort = port => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => tryPort(port + 1));
    server.listen(port, '0.0.0.0', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  };

  tryPort(startPort);
});

const backendPort = await findFreePort(Number(process.env.PORT) || 8000);

const processes = [
  spawn(nodeExecutable, [path.join(rootDir, 'server.js')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(backendPort),
    },
  }),
  spawn(nodeExecutable, [viteBin], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      BACKEND_PORT: String(backendPort),
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
