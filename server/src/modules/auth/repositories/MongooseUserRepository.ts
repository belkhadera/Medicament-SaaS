import User, { IUser } from '../../../models/User';
import { IUserRepository } from '../interfaces';

export class MongooseUserRepository implements IUserRepository {
  public async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email });
  }

  public async findById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  public async create(data: Partial<IUser>): Promise<IUser> {
    return User.create(data);
  }

  public async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, data, { new: true });
  }
}
