import bcrypt from 'bcryptjs';

import { UserRole, UserStatus } from '@finguard/shared';

import { connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { UserModel } from '../models/user.model';

const CANONICAL_EMAIL = 'admin@finguard.ai';
const LEGACY_EMAIL = 'admin@finguard.com';
const CANONICAL_PASSWORD = 'Admin123!';

const canonicalAdminState = (passwordHash: string) => ({
  email: CANONICAL_EMAIL,
  passwordHash,
  firstName: 'Admin',
  lastName: 'User',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  isEmailVerified: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
});

const ensureCanonicalAdmin = async (): Promise<void> => {
  await connectDatabase();

  const [canonicalAdmin, legacyAdmin] = await Promise.all([
    UserModel.findOne({ email: CANONICAL_EMAIL }).exec(),
    UserModel.findOne({ email: LEGACY_EMAIL }).exec(),
  ]);
  const passwordHash = await bcrypt.hash(CANONICAL_PASSWORD, env.BCRYPT_SALT_ROUNDS);

  if (canonicalAdmin) {
    await UserModel.updateOne(
      { _id: canonicalAdmin._id },
      { $set: canonicalAdminState(passwordHash) },
    ).exec();

    if (legacyAdmin && !legacyAdmin._id.equals(canonicalAdmin._id)) {
      await UserModel.updateOne(
        { _id: legacyAdmin._id },
        {
          $set: {
            email: `admin.legacy.${legacyAdmin._id.toString()}@finguard.invalid`,
            status: UserStatus.SUSPENDED,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        },
      ).exec();
    }
  } else if (legacyAdmin) {
    await UserModel.updateOne(
      { _id: legacyAdmin._id },
      { $set: canonicalAdminState(passwordHash) },
    ).exec();
  } else {
    await UserModel.create(canonicalAdminState(passwordHash));
  }

  console.log(`Canonical admin is ready: ${CANONICAL_EMAIL} (${UserRole.ADMIN})`);
};

try {
  await ensureCanonicalAdmin();
} finally {
  await disconnectDatabase();
}
