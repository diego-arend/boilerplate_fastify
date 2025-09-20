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

// User schema
const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must have at least 2 characters'],
    maxlength: [100, 'Name must have at most 100 characters'],
    validate: {
      validator: function(v: string) {
        // Prevent HTML/JavaScript injection
        return !/<script|javascript:|on\w+=/i.test(v);
      },
      message: 'Name contains disallowed characters'
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid email'],
    validate: {
      validator: function(v: string) {
        // Additional validation against malicious emails
        return v.length <= 254 && !/\.\./.test(v);
      },
      message: 'Invalid or too long email'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must have at least 8 characters'],
    maxlength: [128, 'Password too long'],
    select: false, // Does not return password by default in queries
    validate: {
      validator: function(v: string) {
        // Requires at least one lowercase, uppercase, number and special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(v);
      },
      message: 'Password must contain at least one lowercase, uppercase, number and special character'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'suspended'],
      message: 'Status must be: active, inactive or suspended'
    },
    default: 'active'
  },
  role: {
    type: String,
    enum: {
      values: ['user', 'admin'],
      message: 'Role must be: user or admin'
    },
    default: 'user'
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  versionKey: false, // Removes the __v field
  strict: true, // Prevents fields not defined in schema
  minimize: false // Keeps empty objects
});

// Indexes for optimization
// userSchema.index({ email: 1 }); // Removed - already created automatically by unique: true
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save hook for sanitization and additional validations
userSchema.pre('save', function(next) {
  // Sanitize name by removing potentially dangerous characters
  if (this.name) {
    this.name = this.name.replace(/[<>'"&]/g, '');
  }

  // Additional email validation
  if (this.email) {
    // Remove extra whitespace
    this.email = this.email.trim();
    // Convert to lowercase
    this.email = this.email.toLowerCase();
  }

  next();
});

// Pre-update hooks for validations in updates
userSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as any;

  // Sanitize fields if being updated
  if (update.name) {
    update.name = update.name.replace(/[<>'"&]/g, '');
  }

  if (update.email) {
    update.email = update.email.trim().toLowerCase();
  }

  next();
});

// Input sanitization function
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/[<>'"&]/g, '') // Remove HTML characters
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/\.\./g, '.') // Prevent path traversal
    .trim();
}

// Method to compare password (will be implemented with bcrypt)
userSchema.methods.comparePassword = function(candidatePassword: string): Promise<boolean> {
  // Implementation will be done in repository or service
  return Promise.resolve(false);
};

// Method to transform document to JSON (removes sensitive fields)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();

  // Remove sensitive fields
  delete userObject.password;
  delete userObject.__v;

  // Sanitize text fields before returning
  if (userObject.name) {
    userObject.name = sanitizeInput(userObject.name);
  }

  return userObject;
};

// Method to sanitize input data
userSchema.methods.sanitizeInput = sanitizeInput;

// User model
export const UserModel = model<IUser>('User', userSchema);

export default UserModel;