import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import path from 'node:path';

export function canUseS3() {
  return Boolean(process.env.AWS_REGION && process.env.S3_UPLOAD_BUCKET);
}

export function createS3StorageAdapter() {
  const client = new S3Client({ region: process.env.AWS_REGION });
  const bucket = process.env.S3_UPLOAD_BUCKET;
  const prefix = process.env.S3_UPLOAD_PREFIX || 'uploads';

  return {
    mode: 's3',
    async saveFile(file) {
      const ext = path.extname(file.originalname || '.jpg') || '.jpg';
      const key = `${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      }));

      return {
        path: `s3://${bucket}/${key}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storedAt: new Date().toISOString(),
        provider: 's3'
      };
    }
  };
}
