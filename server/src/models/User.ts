import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: 'Administrator' | 'Pharmacist' | 'Inventory Manager' | 'Pharmacy Tech' | 'Viewer';
    status: 'active' | 'inactive';
    lastActive: Date;
    comparePassword: (password: string) => Promise<boolean>;
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
    lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err: any) {
        next(err);
    }
});

UserSchema.methods.comparePassword = async function (password: string) {
    return bcrypt.compare(password, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
