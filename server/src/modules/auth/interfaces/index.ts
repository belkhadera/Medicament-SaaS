import { IUser } from '../../../models/User';

export interface IUserRepository {
  findByEmail(email: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  create(data: Partial<IUser>): Promise<IUser>;
  update(id: string, data: Partial<IUser>): Promise<IUser | null>;
}

export interface ITokenProvider {
  generateToken(payload: object, expiresIn?: string): string;
  verifyToken<T>(token: string): T;
}

export interface IHashProvider {
  generateHash(payload: string): Promise<string>;
  compareHash(payload: string, hashed: string): Promise<boolean>;
}

export interface IEmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}
