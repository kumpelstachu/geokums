import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'src/data');
const to = join(root, 'dist/data');
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log('Copied server/src/data → server/dist/data');
