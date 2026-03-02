import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async login(loginDto: LoginDto, tenantSchema: string) {
    const { email, password } = loginDto;

    // Find user in tenant schema
    const result = await this.dataSource.query(
      `SELECT id, email, password_hash, name, role FROM ${tenantSchema}.users 
       WHERE email = $1 AND is_active = true`,
      [email],
    );

    if (!result || result.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = result[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto, tenantSchema: string) {
    const { email, password, name } = registerDto;

    // Check if user exists
    const existingUser = await this.dataSource.query(
      `SELECT id FROM ${tenantSchema}.users WHERE email = $1`,
      [email],
    );

    if (existingUser && existingUser.length > 0) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, 'agent') 
       RETURNING id, email, name, role`,
      [email, passwordHash, name],
    );

    const user = result[0];

    // Generate tokens
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async validateUser(userId: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `SELECT id, email, name, role FROM ${tenantSchema}.users 
       WHERE id = $1 AND is_active = true`,
      [userId],
    );

    if (!result || result.length === 0) {
      return null;
    }

    return result[0];
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refresh_token);
      
      return {
        access_token: this.jwtService.sign({ sub: payload.sub, email: payload.email }),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
