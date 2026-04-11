/**
 * Script to clear the MongoDB database.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from server root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/code_review';

async function clearDatabase() {
  try {
    console.log(`[Cleaner] Connecting to MongoDB at ${mongodbUri}...`);
    await mongoose.connect(mongodbUri);
    console.log('[Cleaner] Connected. Dropping database...');
    
    await mongoose.connection.db?.dropDatabase();
    
    console.log('[Cleaner] Database cleared successfully.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[Cleaner] Error clearing database:', err);
    process.exit(1);
  }
}

clearDatabase();
