import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Role not found in token');
    }

    const userRole = String(user.role).toLowerCase();
    const hasRole = requiredRoles.map(r => r.toLowerCase()).includes(userRole);

    if (!hasRole) {
      throw new ForbiddenException(
        `Role "${user.role}" is not allowed to access this resource. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
