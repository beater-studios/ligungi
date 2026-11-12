import { spawn } from 'node:child_process';

const run = (name, args) => {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const prefix = (chunk) => chunk.toString().split('\n').filter(Boolean).map((line) => `[${name}] ${line}`).join('\n') + '\n';
  child.stdout.on('data', (chunk) => process.stdout.write(prefix(chunk)));
  child.stderr.on('data', (chunk) => process.stderr.write(prefix(chunk)));
  return child;
};

const children = [run('server', ['run', 'dev', '-w', '@ligungi/server']), run('web', ['run', 'dev', '-w', '@ligungi/web'])];
const stop = () => {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
