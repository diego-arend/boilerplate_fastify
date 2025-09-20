import { Schema, model, Document } from 'mongoose';

// Interface para tipagem TypeScript
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  status: 'active' | 'inactive' | 'suspended';
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

// Schema do usuário
const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres'],
    validate: {
      validator: function(v: string) {
        // Previne injeção de HTML/JavaScript
        return !/<script|javascript:|on\w+=/i.test(v);
      },
      message: 'Nome contém caracteres não permitidos'
    }
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Email inválido'],
    validate: {
      validator: function(v: string) {
        // Validação adicional contra emails maliciosos
        return v.length <= 254 && !/\.\./.test(v);
      },
      message: 'Email inválido ou muito longo'
    }
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [8, 'Senha deve ter pelo menos 8 caracteres'],
    maxlength: [128, 'Senha muito longa'],
    select: false, // Não retorna senha por padrão nas queries
    validate: {
      validator: function(v: string) {
        // Requer pelo menos uma letra minúscula, maiúscula, número e caractere especial
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(v);
      },
      message: 'Senha deve conter pelo menos uma letra minúscula, maiúscula, número e caractere especial'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'suspended'],
      message: 'Status deve ser: active, inactive ou suspended'
    },
    default: 'active'
  },
  role: {
    type: String,
    enum: {
      values: ['user', 'admin'],
      message: 'Role deve ser: user ou admin'
    },
    default: 'user'
  }
}, {
  timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  versionKey: false, // Remove o campo __v
  strict: true, // Impede campos não definidos no schema
  minimize: false // Mantém objetos vazios
});

// Índices para otimização
// userSchema.index({ email: 1 }); // Removido - já criado automaticamente pelo unique: true
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save hook para sanitização e validações adicionais
userSchema.pre('save', function(next) {
  // Sanitiza o nome removendo caracteres potencialmente perigosos
  if (this.name) {
    this.name = this.name.replace(/[<>'"&]/g, '');
  }

  // Validação adicional de email
  if (this.email) {
    // Remove espaços em branco extras
    this.email = this.email.trim();
    // Converte para lowercase
    this.email = this.email.toLowerCase();
  }

  next();
});

// Pre-update hooks para validações em updates
userSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as any;

  // Sanitiza campos se estiverem sendo atualizados
  if (update.name) {
    update.name = update.name.replace(/[<>'"&]/g, '');
  }

  if (update.email) {
    update.email = update.email.trim().toLowerCase();
  }

  next();
});

// Função de sanitização de entrada
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/[<>'"&]/g, '') // Remove caracteres HTML
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/\.\./g, '.') // Previne path traversal
    .trim();
}

// Método para comparar senha (será implementado com bcrypt)
userSchema.methods.comparePassword = function(candidatePassword: string): Promise<boolean> {
  // Implementação será feita no repositório ou service
  return Promise.resolve(false);
};

// Método para transformar o documento em JSON (remove campos sensíveis)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();

  // Remove campos sensíveis
  delete userObject.password;
  delete userObject.__v;

  // Sanitiza campos de texto antes de retornar
  if (userObject.name) {
    userObject.name = sanitizeInput(userObject.name);
  }

  return userObject;
};

// Método para sanitizar dados de entrada
userSchema.methods.sanitizeInput = sanitizeInput;

// Modelo do usuário
export const UserModel = model<IUser>('User', userSchema);

export default UserModel;