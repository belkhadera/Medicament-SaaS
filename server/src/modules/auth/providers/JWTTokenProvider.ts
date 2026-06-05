import jwt, { SignOptions } from 'jsonwebtoken';
import { ITokenProvider } from '../interfaces';

export class JWTTokenProvider implements ITokenProvider {
  private readonly secret: string;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'fallback_secret';
  }

  public generateToken(payload: object, expiresIn: string = '1d'): string {
    const options: SignOptions = { expiresIn: expiresIn as any };
    return jwt.sign(payload, this.secret, options);
  }

  public verifyToken<T>(token: string): T {
    return jwt.verify(token, this.secret) as T;
  }
}
