import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
  constructor(private dataSource: DataSource) {}

  async findAll(tenantSchema: string) {
    return this.dataSource.query(
      `SELECT id, email, name, role, is_active, last_login_at, created_at 
       FROM ${tenantSchema}.users 
       ORDER BY created_at DESC`,
    );
  }

  async findOne(tenantSchema: string, id: string) {
    const result = await this.dataSource.query(
      `SELECT id, email, name, role, is_active, last_login_at, created_at 
       FROM ${tenantSchema}.users WHERE id = $1`,
      [id],
    );
    if (!result.length) throw new NotFoundException('User not found');
    return result[0];
  }

  async create(tenantSchema: string, data: { email: string; password: string; name?: string; role?: string }) {
    // Check if email exists
    const existing = await this.dataSource.query(
      `SELECT id FROM ${tenantSchema}.users WHERE email = $1`,
      [data.email],
    );
    if (existing.length) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, name, role, is_active, created_at`,
      [data.email, passwordHash, data.name || null, data.role || 'agent'],
    );
    return result[0];
  }

  async update(tenantSchema: string, id: string, data: { name?: string; role?: string; is_active?: boolean }) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(data.role);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(data.is_active);
    }

    if (updates.length === 0) return this.findOne(tenantSchema, id);

    params.push(id);
    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.users 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING id, email, name, role, is_active, created_at`,
      params,
    );
    if (!result.length) throw new NotFoundException('User not found');
    return result[0];
  }

  async delete(tenantSchema: string, id: string) {
    const result = await this.dataSource.query(
      `DELETE FROM ${tenantSchema}.users WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.length) throw new NotFoundException('User not found');
    return { success: true };
  }

  async resetPassword(tenantSchema: string, id: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.users SET password_hash = $1 WHERE id = $2 RETURNING id`,
      [passwordHash, id],
    );
    if (!result.length) throw new NotFoundException('User not found');
    return { success: true };
  }
}
