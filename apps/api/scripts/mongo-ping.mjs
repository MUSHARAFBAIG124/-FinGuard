import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(2);
}

if (uri.includes('<db_password>')) {
  console.error('MONGODB_URI still contains the <db_password> placeholder.');
  process.exit(2);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 10000,
});

const redact = (value) =>
  value
    .replace(uri, '[redacted-mongodb-uri]')
    .replace(/mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/g, 'mongodb$1://$2:[redacted]@');

try {
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  console.log('MongoDB ping succeeded.');
} catch (error) {
  const errorName = error?.name ?? 'MongoConnectionError';
  const message = redact(String(error?.message ?? error));

  console.error('MongoDB ping failed.');
  console.error(`${errorName}: ${message}`);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => undefined);
}
