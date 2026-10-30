import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await cp('src', 'dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
console.log('Built static app in dist/');
