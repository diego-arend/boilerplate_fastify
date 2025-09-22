import mongoose from 'mongoose';
import { config } from '../../lib/validators/validateEnv.js';

class MongoConnection {
  private static instance: MongoConnection;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): MongoConnection {
    if (!MongoConnection.instance) {
      MongoConnection.instance = new MongoConnection();
    }
    return MongoConnection.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('MongoDB already connected');
      return;
    }

    try {
      await mongoose.connect(config.MONGO_URI, {
        serverSelectionTimeoutMS: 5000, // Server selection timeout
        socketTimeoutMS: 45000, // Socket timeout
        bufferCommands: false, // Disable command buffering
        maxPoolSize: 10, // Maximum connection pool size
      });
      this.isConnected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  public getConnection(): mongoose.Connection {
    return mongoose.connection;
  }
}

export default MongoConnection;