import mongoose from 'mongoose';

export async function connectDB() {
  try {
    let mongoUri = process.env.MONGODB_URI;

    // In-memory MongoDB is OPT-IN ONLY (explicit USE_IN_MEMORY_DB=true). It is
    // ephemeral — data does NOT persist between restarts — so it must never be
    // the silent default. By default we always connect to the real database in
    // MONGODB_URI so user data is stored and preserved.
    if (process.env.USE_IN_MEMORY_DB === 'true') {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      (global as any).__MONGOD__ = mongod;
      console.warn('🧪 USE_IN_MEMORY_DB=true — using throwaway in-memory MongoDB. Data will NOT persist.');
    }

    if (!mongoUri) {
      throw new Error(
        'MONGODB_URI is not set. Add it to server/.env ' +
        '(e.g. mongodb://localhost:27017/healthcare-saas) or set USE_IN_MEMORY_DB=true ' +
        'for a throwaway in-memory database.',
      );
    }

    await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB connected (db: ${mongoose.connection.name})`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}
