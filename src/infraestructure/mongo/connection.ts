import mongoose from 'mongoose';
import { config } from '../../lib/validateEnv.js';

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
      console.log('MongoDB já conectado');
      return;
    }

    try {
      await mongoose.connect(config.MONGO_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout para seleção do servidor
        socketTimeoutMS: 45000, // Timeout do socket
        bufferCommands: false, // Desabilitar buffering de comandos
        maxPoolSize: 10, // Tamanho máximo do pool de conexões
      });
      this.isConnected = true;
      console.log('Conectado ao MongoDB');
    } catch (error) {
      console.error('Erro ao conectar ao MongoDB:', error);
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
      console.log('Desconectado do MongoDB');
    } catch (error) {
      console.error('Erro ao desconectar do MongoDB:', error);
      throw error;
    }
  }

  public getConnection(): mongoose.Connection {
    return mongoose.connection;
  }
}

export default MongoConnection;