import { 
  IUserRepository, 
  ITokenProvider, 
  IHashProvider, 
  IEmailProvider 
} from '../interfaces';
import { IUser } from '../../../models/User';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../../../core/errors/AppError';

export class AuthService {
  constructor(
    private userRepository: IUserRepository,
    private tokenProvider: ITokenProvider,
    private hashProvider: IHashProvider,
    private emailProvider: IEmailProvider
  ) {}

  public async register(data: any): Promise<{ user: Partial<IUser>, accessToken: string, refreshToken: string }> {
    const { email, name, password, role } = data;

    const userExists = await this.userRepository.findByEmail(email);
    if (userExists) {
      throw new BadRequestError('User already exists');
    }

    const hashedPassword = await this.hashProvider.generateHash(password);
    
    const user = await this.userRepository.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'Pharmacist',
    });

    const accessToken = this.tokenProvider.generateToken({ id: user._id }, '15m');
    const refreshToken = this.tokenProvider.generateToken({ id: user._id }, '7d');

    user.refreshToken = refreshToken;
    await this.userRepository.update(user._id as string, { refreshToken });

    // Send welcome email
    await this.emailProvider.sendEmail(
      email,
      'Welcome to Medicament SaaS',
      `<h1>Welcome ${name}!</h1><p>Your account has been successfully created.</p>`
    );

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  public async login(data: any): Promise<{ user: Partial<IUser>, accessToken: string, refreshToken: string }> {
    const { email, password } = data;

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordMatch = await this.hashProvider.compareHash(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = this.tokenProvider.generateToken({ id: user._id }, '15m');
    const refreshToken = this.tokenProvider.generateToken({ id: user._id }, '7d');

    user.lastActive = new Date();
    user.refreshToken = refreshToken;
    await this.userRepository.update(user._id as string, { 
      lastActive: user.lastActive,
      refreshToken 
    });

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  public async refresh(token: string): Promise<{ accessToken: string, refreshToken: string }> {
    try {
      const decoded: any = this.tokenProvider.verifyToken(token);
      const user = await this.userRepository.findById(decoded.id);

      if (!user || user.refreshToken !== token) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const accessToken = this.tokenProvider.generateToken({ id: user._id }, '15m');
      const newRefreshToken = this.tokenProvider.generateToken({ id: user._id }, '7d');

      user.refreshToken = newRefreshToken;
      await this.userRepository.update(user._id as string, { refreshToken: newRefreshToken });

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  public async getProfile(userId: string): Promise<IUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  public async updateProfile(userId: string, data: any): Promise<IUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (data.password) {
      data.password = await this.hashProvider.generateHash(data.password);
    }

    const updatedUser = await this.userRepository.update(userId, data);
    if (!updatedUser) {
      throw new NotFoundError('User not found');
    }

    return updatedUser;
  }

  public async changePassword(userId: string, data: any): Promise<void> {
    const { currentPassword, newPassword } = data;
    const user = await this.userRepository.findById(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await this.hashProvider.compareHash(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await this.hashProvider.generateHash(newPassword);
    await this.userRepository.update(userId, { password: hashedPassword });
  }
}
