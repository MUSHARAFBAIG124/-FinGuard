import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB status = connected');

    const db = mongoose.connection.db;
    const admin = await db.collection('users').findOne({ email: 'admin@finguard.ai' });

    console.log('\n--- Admin User Info ---');
    if (admin) {
      console.log('Exists: true');
      console.log(`Role: ${admin.role}`);
      console.log(`CreatedAt: ${admin.createdAt}`);
      console.log(`Active status: ${admin.status}`);

      const match = await bcrypt.compare('Admin123!', admin.passwordHash);
      console.log(`Password Match: ${match ? 'MATCH' : 'MISMATCH'}`);
    } else {
      console.log('Exists: false');
    }
  } catch (err) {
    console.error('Error connecting to DB', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
