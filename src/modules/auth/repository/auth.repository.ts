import { Model } from 'mongoose';
import type { FilterQuery, UpdateQuery } from 'mongoose';
import { BaseRepository } from '../../../infraestructure/mongo/baseRepository.js';
import { UserModel, type IUser } from '../../../entities/user/index.js';
import { SecurityValidators } from '../../../entities/user/index.js';

export class AuthRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel as Model<IUser>);
  }

  /**
   * Busca usuário por email para autenticação
   */
  async findByEmail(email: string): Promise<IUser | null> {
    const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

    if (!SecurityValidators.isValidEmail(sanitizedEmail)) {
      throw new Error('Email inválido');
    }

    return await this.findOne({ email: sanitizedEmail });
  }

  /**
   * Busca usuário por email incluindo senha (para login)
   */
  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

    if (!SecurityValidators.isValidEmail(sanitizedEmail)) {
      throw new Error('Email inválido');
    }

    return await this.model.findOne({ email: sanitizedEmail }).select('+password').exec();
  }

  /**
   * Cria um novo usuário para registro
   */
  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: 'user' | 'admin';
  }): Promise<IUser> {
    const sanitizedData = {
      name: SecurityValidators.sanitizeInput(userData.name),
      email: SecurityValidators.sanitizeInput(userData.email).toLowerCase(),
      password: userData.password,
      role: userData.role || 'user'
    };

    if (!SecurityValidators.isValidEmail(sanitizedData.email)) {
      throw new Error('Email inválido');
    }

    if (!SecurityValidators.isStrongPassword(userData.password)) {
      throw new Error('Senha não atende aos requisitos de segurança');
    }

    const existingUser = await this.findByEmail(sanitizedData.email);
    if (existingUser) {
      throw new Error('Email já cadastrado');
    }

    return await this.create(sanitizedData as Partial<IUser>);
  }

  /**
   * Busca usuário por ID (para JWT verification)
   */
  async findByIdForAuth(id: string): Promise<IUser | null> {
    return await this.findById(id);
  }

  /**
   * Verifica se email existe (para registro)
   */
  async emailExists(email: string): Promise<boolean> {
    const sanitizedEmail = SecurityValidators.sanitizeInput(email).toLowerCase();

    if (!SecurityValidators.isValidEmail(sanitizedEmail)) {
      return false;
    }

    const count = await this.count({ email: sanitizedEmail });
    return count > 0;
  }

  /**
   * Atualiza último login do usuário (opcional)
   */
  async updateLastLogin(userId: string): Promise<IUser | null> {
    return await this.updateById(userId, {
      updatedAt: new Date()
    } as UpdateQuery<IUser>);
  }
}
