import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, '..', '..');
export const dataDirectory = path.join(projectRoot, 'data');
export const uploadsDirectory = path.join(projectRoot, 'uploads');
