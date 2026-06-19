import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: 'Administrator' | 'Pharmacist' | 'Inventory Manager' | 'Pharmacy Tech' | 'Viewer';
    status: 'active' | 'inactive';
    lastActive: Date;
    refreshToken?: string;
    isEmailVerified: boolean;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['Administrator', 'Pharmacist', 'Inventory Manager', 'Pharmacy Tech', 'Viewer'],
        default: 'Pharmacist'
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastActive: { type: Date, default: Date.now },
    refreshToken: { type: String },

    // Email verification (token stored hashed; see auth/utils/tokenHelpers)
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },

    // Password reset (token stored hashed)
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date }
}, { timestamps: true });

// NOTE: Password hashing is owned by the auth layer (auth.service via bcrypt),
// not the model. A pre('save') hook here would double-hash on register and
// would not run for findByIdAndUpdate-based profile updates.

export default mongoose.model<IUser>('User', UserSchema);
