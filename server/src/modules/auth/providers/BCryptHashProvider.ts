import bcrypt from 'bcryptjs';
import { IHashProvider } from '../interfaces';

export class BCryptHashProvider implements IHashProvider {
  public async generateHash(payload: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(payload, salt);
  }

  public async compareHash(payload: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(payload, hashed);
  }
}
