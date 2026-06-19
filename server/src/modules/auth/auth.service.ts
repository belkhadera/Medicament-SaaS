import bcrypt from 'bcryptjs';
import User, { IUser } from '../../models/User';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../../core/errors/AppError';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  createSecureToken,
  hashToken,
  minutesFromNow,
} from './auth.tokens';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
} from './email/emails';

type AuthTokens = { accessToken: string; refreshToken: string };
type AuthResult = { user: Partial<IUser> } & AuthTokens;

// ---- config ----------------------------------------------------------------

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const verifyExpiryMin = () => Number(process.env.EMAIL_VERIFICATION_EXPIRE_MIN || 60);
const resetExpiryMin = () => Number(process.env.PASSWORD_RESET_EXPIRE_MIN || 30);

// ---- helpers ---------------------------------------------------------------

function issueTokens(userId: string): AuthTokens {
  return {
    accessToken: generateAccessToken(userId),
    refreshToken: generateRefreshToken(userId),
  };
}

function publicUser(user: IUser): Partial<IUser> {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };
}

/** Send an email without letting a mail failure break the request flow. */
async function safeSend(action: Promise<void>): Promise<void> {
  try {
    await action;
  } catch (error) {
    console.error('Email send failed:', error);
  }
}

// ---- registration & verification -------------------------------------------

export async function register(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
}): Promise<{ message: string; email: string }> {
  const { name, email, password, role } = data;

  const exists = await User.findOne({ email });
  if (exists) {
    throw new BadRequestError('Cet utilisateur existe déjà');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const { token, hashed } = createSecureToken();

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || 'Pharmacist',
    isEmailVerified: false,
    emailVerificationToken: hashed,
    emailVerificationExpires: minutesFromNow(verifyExpiryMin()),
  });

  const verifyUrl = `${clientUrl()}/?mode=verify-email&token=${token}`;
  await safeSend(sendVerificationEmail(user.email, user.name, verifyUrl, verifyExpiryMin()));

  return {
    message: 'Inscription réussie. Veuillez consulter votre e-mail pour vérifier votre compte.',
    email: user.email,
  };
}

export async function verifyEmail(token: string): Promise<AuthResult> {
  if (!token) {
    throw new BadRequestError('Le jeton de vérification est requis');
  }

  const user = await User.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
  });
  if (!user) {
    throw new BadRequestError('Lien de vérification invalide ou expiré');
  }

  const tokens = issueTokens(user._id as string);
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  user.refreshToken = tokens.refreshToken;
  user.lastActive = new Date();
  await user.save();

  await safeSend(sendWelcomeEmail(user.email, user.name, `${clientUrl()}/`));

  return { user: publicUser(user), ...tokens };
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const message =
    'Si un compte non vérifié existe pour cet e-mail, un nouveau lien de vérification a été envoyé.';

  const user = await User.findOne({ email });
  if (!user || user.isEmailVerified) {
    return { message };
  }

  const { token, hashed } = createSecureToken();
  user.emailVerificationToken = hashed;
  user.emailVerificationExpires = minutesFromNow(verifyExpiryMin());
  await user.save();

  const verifyUrl = `${clientUrl()}/?mode=verify-email&token=${token}`;
  await safeSend(sendVerificationEmail(user.email, user.name, verifyUrl, verifyExpiryMin()));

  return { message };
}

// ---- login / refresh / logout ----------------------------------------------

export async function login(data: { email: string; password: string }): Promise<AuthResult> {
  const { email, password } = data;

  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthorizedError('E-mail ou mot de passe invalide');
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new UnauthorizedError('E-mail ou mot de passe invalide');
  }

  if (!user.isEmailVerified) {
    throw new UnauthorizedError('Veuillez vérifier votre e-mail avant de vous connecter.');
  }

  const tokens = issueTokens(user._id as string);
  user.lastActive = new Date();
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return { user: publicUser(user), ...tokens };
}

export async function refresh(token: string): Promise<AuthTokens> {
  try {
    const decoded = verifyToken<{ id: string }>(token);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== token) {
      throw new UnauthorizedError('Jeton de rafraîchissement invalide');
    }

    const tokens = issueTokens(user._id as string);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return tokens;
  } catch {
    throw new UnauthorizedError('Jeton de rafraîchissement invalide');
  }
}

export async function logout(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { refreshToken: undefined });
}

// ---- password reset --------------------------------------------------------

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const message = 'Si un compte existe pour cet e-mail, un lien de réinitialisation a été envoyé.';

  const user = await User.findOne({ email });
  if (!user) {
    return { message };
  }

  const { token, hashed } = createSecureToken();
  user.passwordResetToken = hashed;
  user.passwordResetExpires = minutesFromNow(resetExpiryMin());
  await user.save();

  const resetUrl = `${clientUrl()}/?mode=reset-password&token=${token}`;
  await safeSend(sendPasswordResetEmail(user.email, user.name, resetUrl, resetExpiryMin()));

  return { message };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  if (!token) {
    throw new BadRequestError('Le jeton de réinitialisation est requis');
  }

  const user = await User.findOne({
    passwordResetToken: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) {
    throw new BadRequestError('Lien de réinitialisation invalide ou expiré');
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined; // invalidate existing sessions
  await user.save();

  await safeSend(sendPasswordResetSuccessEmail(user.email, user.name, `${clientUrl()}/`));

  return { message: 'Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.' };
}

// ---- profile ---------------------------------------------------------------

export async function getProfile(userId: string): Promise<IUser> {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable');
  }
  return user;
}

export async function updateProfile(
  userId: string,
  data: { name?: string; email?: string; password?: string }
): Promise<IUser> {
  const update: Partial<IUser> = {};
  if (data.name) update.name = data.name;
  if (data.email) update.email = data.email;
  if (data.password) update.password = await bcrypt.hash(data.password, 10);

  const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password');
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable');
  }
  return user;
}

// ---- admin user management -------------------------------------------------

/** Every account, newest first, without any sensitive/credential fields. */
export async function listUsers(): Promise<IUser[]> {
  return User.find()
    .select('-password -refreshToken -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires')
    .sort({ createdAt: -1 });
}

/** Admin edit of another user's display name, role and activation status. */
export async function adminUpdateUser(
  userId: string,
  data: { name?: string; role?: IUser['role']; status?: IUser['status'] }
): Promise<IUser> {
  const update: Partial<IUser> = {};
  if (data.name) update.name = data.name;
  if (data.role) update.role = data.role;
  if (data.status) update.status = data.status;

  const user = await User.findByIdAndUpdate(userId, update, { new: true })
    .select('-password -refreshToken -emailVerificationToken -passwordResetToken');
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable');
  }
  return user;
}

export async function changePassword(
  userId: string,
  data: { currentPassword: string; newPassword: string }
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable');
  }

  const isMatch = await bcrypt.compare(data.currentPassword, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Le mot de passe actuel est incorrect');
  }

  user.password = await bcrypt.hash(data.newPassword, 10);
  await user.save();

  await safeSend(sendPasswordResetSuccessEmail(user.email, user.name, `${clientUrl()}/`));
}
