import { cp, mkdir, rm } from 'node:fs/promises';
await rm('desktop/dist', { recursive: true, force: true });
await mkdir('desktop/dist', { recursive: true });
await cp('dist', 'desktop/dist', { recursive: true });
await cp('src/lib/project.js', 'desktop/project.js');
console.log('Desktop assets ready.');
