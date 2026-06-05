import mongoose from 'mongoose';

export async function connectDB() {
  try {
    let mongoUri = process.env.MONGODB_URI;
    let mongod: any = null;

    // If explicitly requested or no URI provided, start an in-memory MongoDB for dev/testing
    if (!mongoUri || process.env.USE_IN_MEMORY_DB === 'true') {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      console.log('🧪 Using in-memory MongoDB for development');
    }

    await mongoose.connect(mongoUri ?? 'mongodb://localhost:27017/healthcare-saas');
    console.log('✅ MongoDB connected');

    // expose mongod for graceful shutdown in other modules if needed
    if (mongod) {
      (global as any).__MONGOD__ = mongod;
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}
