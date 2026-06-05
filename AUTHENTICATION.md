# Authentication System Documentation

## Overview

MediTrack Healthcare implements a JWT-based authentication system with the following features:

- User registration and login
- Role-based access control (RBAC)
- Token refresh mechanism
- Password change functionality
- Secure password hashing with bcrypt

## Features Implemented

### Backend (Express + MongoDB)

#### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and receive JWT token
- `POST /api/auth/refresh` - Refresh JWT token (protected)
- `GET /api/auth/profile` - Get current user profile (protected)
- `PUT /api/auth/profile` - Update user profile (protected)
- `POST /api/auth/change-password` - Change password (protected)

#### User Roles

1. **Administrator** - Full system access
2. **Pharmacist** - Medication management
3. **Inventory Manager** - Stock management
4. **Pharmacy Tech** - Assistant-level access
5. **Viewer** - Read-only access

#### Security Features

- Passwords hashed with bcrypt (salt rounds: 10)
- JWT tokens with 30-day expiration for login, 7 days for API tokens
- Protected routes require valid JWT token in Authorization header
- Admin-only routes with role verification
- CORS configured for development

### Frontend (React + TypeScript)

#### Authentication Services

- `authService.register()` - Register new account
- `authService.login()` - Authenticate user
- `authService.refreshToken()` - Refresh token before expiry
- `authService.logout()` - Clear auth state
- `authService.getCurrentUser()` - Get stored user
- `authService.initAuth()` - Initialize auth on app load
- `authService.updateProfile()` - Update user info
- `authService.changePassword()` - Change password

#### UI Components

- **LoginScreen** - Email/password login form
- **RegisterScreen** - New user registration form
- **MainLayout** - Protected dashboard layout

#### Token Management

- Tokens stored in localStorage
- Automatically set in API headers (Authorization: Bearer {token})
- Auto-logout on invalid token
- Token refresh before making requests

## Setup Instructions

### Backend Setup

1. **Install dependencies**

   ```bash
   cd server
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env`
   - Set `JWT_SECRET` to a secure random string
   - Configure MongoDB connection

3. **Seed test data**

   ```bash
   npm run seed
   ```

   Creates test users:
   - Email: `sarah.j@hospital.com`, Password: `password123`, Role: Administrator
   - Email: `john.m@hospital.com`, Password: `password123`, Role: Pharmacist

4. **Start development server**
   ```bash
   npm run dev
   ```
   Server runs on http://localhost:3000

### Frontend Setup

1. **Install dependencies**

   ```bash
   cd client
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```
   Client runs on http://localhost:5173

## API Usage Examples

### Register

```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane.smith@hospital.com",
  "password": "SecurePass123",
  "role": "Pharmacist"
}
```

### Login

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "sarah.j@hospital.com",
  "password": "password123"
}

Response:
{
  "_id": "...",
  "name": "Dr. Sarah Johnson",
  "email": "sarah.j@hospital.com",
  "role": "Administrator",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Get Profile (Protected)

```bash
GET http://localhost:3000/api/auth/profile
Authorization: Bearer {token}
```

### Refresh Token (Protected)

```bash
POST http://localhost:3000/api/auth/refresh
Authorization: Bearer {token}
```

### Change Password (Protected)

```bash
POST http://localhost:3000/api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "password123",
  "newPassword": "newSecurePass123"
}
```

## Frontend Authentication Flow

### Login Flow

1. User enters credentials on LoginScreen
2. `authService.login()` calls `/api/auth/login`
3. Server returns JWT token
4. Token stored in localStorage
5. Token added to all subsequent API requests
6. User redirected to dashboard

### Registration Flow

1. User fills registration form
2. `authService.register()` calls `/api/auth/register`
3. New user created with hashed password
4. JWT token returned
5. Same flow as login continues

### Token Refresh

1. Check token expiration on app load
2. If near expiry, call `authService.refreshToken()`
3. New token received and stored
4. User stays logged in

### Logout

1. `authService.logout()` removes token from storage
2. Auth headers cleared from API client
3. User redirected to login screen

## Security Best Practices

### Implemented

✅ Passwords hashed with bcrypt (10 salt rounds)
✅ JWT tokens with expiration
✅ Protected routes require valid token
✅ CORS configured
✅ Input validation on register/login
✅ Error messages don't leak user information

### Production Recommendations

- [ ] Change JWT_SECRET to strong random string
- [ ] Use HTTPS in production
- [ ] Set SECURE flag on cookies (if using cookies)
- [ ] Implement rate limiting on auth endpoints
- [ ] Add email verification for registration
- [ ] Implement password reset email flow
- [ ] Add 2FA (two-factor authentication)
- [ ] Set appropriate CORS origins for production
- [ ] Use environment variables for all secrets

## Testing Credentials

### Administrator

- Email: `sarah.j@hospital.com`
- Password: `password123`
- Role: Administrator

### Pharmacist

- Email: `john.m@hospital.com`
- Password: `password123`
- Role: Pharmacist

## Troubleshooting

### "Cannot find package 'jsonwebtoken'"

- Run `npm install` in server directory
- Ensure jsonwebtoken is in package.json dependencies

### Token validation fails

- Check JWT_SECRET matches between .env and code
- Verify token format: "Bearer {token}"
- Ensure token hasn't expired (30 days)

### CORS errors

- Check CLIENT_URL and CORS_ORIGIN in .env
- Verify frontend is running on correct port

### Protected routes return 401

- Ensure token is valid and not expired
- Check Authorization header format
- Verify user exists in database

## File Structure

```
server/
├── src/
│   ├── controllers/
│   │   └── authController.ts      # Auth business logic
│   ├── middleware/
│   │   ├── authMiddleware.ts      # JWT verification
│   │   └── errorHandler.ts        # Error handling
│   ├── models/
│   │   └── User.ts                # User schema with password hashing
│   ├── routes/
│   │   └── auth.ts                # Auth endpoints
│   └── config/
│       └── db.ts                  # MongoDB connection
│
client/
├── src/
│   ├── services/
│   │   ├── auth.service.ts        # Auth API calls
│   │   └── api.ts                 # Axios instance
│   ├── app/
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx    # Login UI
│   │   │   ├── RegisterScreen.tsx # Registration UI
│   │   │   └── DashboardScreen.tsx
│   │   └── App.tsx                # Main app router
│   └── main.tsx                   # Entry point
```

## Next Steps

1. **Email Verification** - Verify email after registration
2. **Password Reset** - Implement password reset via email
3. **Two-Factor Authentication** - Add MFA support
4. **OAuth Integration** - Add Google/GitHub login
5. **Session Management** - Track active sessions
6. **Audit Logging** - Log authentication events
7. **Rate Limiting** - Prevent brute force attacks
8. **Refresh Token Rotation** - Implement token rotation
