import { spawn } from 'node:child_process';
import path from 'node:path';

const children = [];
const nodeCommand = process.execPath;
const viteCli = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');

function startProcess(command, args, label) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${label} exited with code ${code}`);
      shutdown(code || 1);
    }
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  while (children.length > 0) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startProcess(nodeCommand, ['server/api-server.mjs'], 'API server');
startProcess(nodeCommand, [viteCli], 'Vite dev server');
