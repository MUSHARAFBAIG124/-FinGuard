import { createHash } from 'node:crypto';

import mongoose, { Types } from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI must be set for the read-only seed audit.');
  process.exit(1);
}

const email = (process.env.FINGUARD_DEV_SEED_EMAIL ?? 'finguard.qa@example.test')
  .trim()
  .toLowerCase();
const printDeleteCommands = process.argv.includes('--print-delete-commands');
const objectIdFor = (key: string): Types.ObjectId =>
  new Types.ObjectId(
    createHash('sha256').update(`finguard-dev-seed:${key}`).digest('hex').slice(0, 24),
  );

const loanIds = [
  objectIdFor('loan-submitted'),
  objectIdFor('loan-under-review'),
  objectIdFor('loan-approved'),
];
const fraudCaseIds = [
  objectIdFor('fraud-open-case'),
  objectIdFor('fraud-assigned-case'),
  objectIdFor('fraud-resolved-case'),
];

const printIds = (ids: readonly Types.ObjectId[]): string =>
  ids.length ? ids.map((id) => id.toHexString()).join(', ') : '(none)';

const run = async (): Promise<void> => {
  // This helper intentionally uses only find queries and never imports dotenv.
  const connection = await mongoose
    .createConnection(uri, {
      readPreference: 'secondaryPreferred',
      serverSelectionTimeoutMS: 5_000,
    })
    .asPromise();

  try {
    const database = connection.db;
    if (!database) throw new Error('Database handle unavailable');

    const [users, loans, fraudCases] = await Promise.all([
      database.collection('users').find({ email }, { projection: { _id: 1 } }).toArray(),
      database
        .collection('loan_applications')
        .find({ _id: { $in: loanIds } }, { projection: { _id: 1 } })
        .toArray(),
      database
        .collection('fraudcases')
        .find({ _id: { $in: fraudCaseIds } }, { projection: { _id: 1 } })
        .toArray(),
    ]);

    const userIds = users.map((document) => document._id.toString());
    const loanMatches = loans.map((document) => document._id.toString());
    const fraudCaseMatches = fraudCases.map((document) => document._id.toString());

    console.log(`users collection: count=${users.length}; _ids=${userIds.join(', ') || '(none)'}`);
    console.log(
      `loan_applications collection: count=${loans.length}; _ids=${loanMatches.join(', ') || '(none)'}`,
    );
    console.log(
      `fraudcases collection: count=${fraudCases.length}; _ids=${fraudCaseMatches.join(', ') || '(none)'}`,
    );

    if (printDeleteCommands) {
      const idsAsObjectIds = (ids: readonly Types.ObjectId[]) =>
        `[${ids.map((id) => `ObjectId('${id.toHexString()}')`).join(', ')}]`;
      console.log('\nReview-only mongosh commands (not executed):');
      console.log(`db.users.deleteMany({ email: ${JSON.stringify(email)} })`);
      console.log(
        `db.loan_applications.deleteMany({ _id: { $in: ${idsAsObjectIds(loanIds)} } })`,
      );
      console.log(`db.fraudcases.deleteMany({ _id: { $in: ${idsAsObjectIds(fraudCaseIds)} } })`);
    }
  } finally {
    await connection.close();
  }
};

run().catch(async () => {
  // Driver errors can include connection details; suppress them to protect the URI.
  console.error('Seed audit failed; connection details were suppressed.');
  process.exitCode = 1;
});
