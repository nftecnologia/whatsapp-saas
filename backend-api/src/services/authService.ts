import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '@/models/User';
import { CompanyModel } from '@/models/Company';
import { AuthUser } from '@/types';
import { createError } from '@/middleware/errorHandler';

export class AuthService {
  static async login(email: string, password: string): Promise<{
    user: AuthUser;
    token: string;
    company: any;
  }> {
    const user = await UserModel.findByEmail(email);
    
    if (!user) {
      throw createError('Invalid credentials', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      throw createError('Invalid credentials', 401);
    }

    if (!user.is_active) {
      throw createError('Account is deactivated', 401);
    }

    const company = await CompanyModel.findById(user.company_id);
    
    if (!company || !company.is_active) {
      throw createError('Company is deactivated', 401);
    }

    await UserModel.updateLastLogin(user.id);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      company_id: user.company_id,
      role: user.role
    };

    const token = this.generateToken(authUser);

    return {
      user: authUser,
      token,
      company: {
        id: company.id,
        name: company.name,
        plan: company.plan
      }
    };
  }

  static async register(userData: {
    email: string;
    password: string;
    name: string;
    companyName: string;
    companyEmail: string;
    companyPhone?: string;
  }): Promise<{
    user: AuthUser;
    token: string;
    company: any;
  }> {
    const existingUser = await UserModel.findByEmail(userData.email);
    if (existingUser) {
      throw createError('Email already registered', 400);
    }

    const existingCompany = await CompanyModel.findByEmail(userData.companyEmail);
    if (existingCompany) {
      throw createError('Company email already registered', 400);
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const company = await CompanyModel.create({
      name: userData.companyName,
      email: userData.companyEmail,
      phone: userData.companyPhone,
      plan: 'free'
    });

    const user = await UserModel.create({
      email: userData.email,
      name: userData.name,
      password_hash: hashedPassword,
      company_id: company.id,
      role: 'admin'
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      company_id: user.company_id,
      role: user.role
    };

    const token = this.generateToken(authUser);

    return {
      user: authUser,
      token,
      company: {
        id: company.id,
        name: company.name,
        plan: company.plan
      }
    };
  }

  static async refreshToken(userId: string): Promise<{
    user: AuthUser;
    token: string;
  }> {
    const user = await UserModel.findById(userId);
    
    if (!user || !user.is_active) {
      throw createError('User not found or deactivated', 404);
    }

    const company = await CompanyModel.findById(user.company_id);
    
    if (!company || !company.is_active) {
      throw createError('Company is deactivated', 401);
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      company_id: user.company_id,
      role: user.role
    };

    const token = this.generateToken(authUser);

    return {
      user: authUser,
      token
    };
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw createError('User not found', 404);
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      throw createError('Current password is incorrect', 400);
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    await UserModel.update(userId, {
      password_hash: hashedNewPassword
    });
  }

  static generateToken(user: AuthUser): string {
    return jwt.sign(
      user,
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  static verifyToken(token: string): AuthUser {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    } catch (error) {
      throw createError('Invalid token', 401);
    }
  }

  static async validateStackAuthToken(stackToken: string): Promise<AuthUser | null> {
    try {
      const response = await fetch(`https://api.stack-auth.com/api/v1/users/me`, {
        headers: {
          'Authorization': `Bearer ${stackToken}`,
          'X-Stack-Project-Id': process.env.STACK_AUTH_PROJECT_ID!,
        }
      });

      if (!response.ok) {
        return null;
      }

      const stackUser = await response.json();

      let user = await UserModel.findByEmail(stackUser.email);
      
      if (!user) {
        const company = await CompanyModel.create({
          name: stackUser.displayName || 'New Company',
          email: stackUser.email,
          plan: 'free'
        });

        user = await UserModel.create({
          email: stackUser.email,
          name: stackUser.displayName || stackUser.email,
          password_hash: await bcrypt.hash(Math.random().toString(36), 10),
          company_id: company.id,
          role: 'admin'
        });
      }

      await UserModel.updateLastLogin(user.id);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        company_id: user.company_id,
        role: user.role
      };
    } catch (error) {
      console.error('Stack Auth validation error:', error);
      return null;
    }
  }
}