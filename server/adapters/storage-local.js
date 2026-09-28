import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { uploadsDirectory } from '../utils/paths.js';

export function createLocalStorageAdapter() {
  const targetDirectory = process.env.LOCAL_UPLOADS_DIR || uploadsDirectory;

  return {
    mode: 'local-uploads',
    async saveFile(file) {
      await fs.mkdir(targetDirectory, { recursive: true });
      const ext = path.extname(file.originalname || '.jpg') || '.jpg';
      const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      const outputPath = path.join(targetDirectory, fileName);
      await fs.writeFile(outputPath, file.buffer);

      return {
        path: `/uploads/${fileName}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storedAt: new Date().toISOString(),
        provider: 'local-uploads'
      };
    }
  };
}
