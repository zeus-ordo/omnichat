import { Controller, Post, Body, Req, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, AuthResponseDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('Authentication')
@Controller('auth')
@ApiExtraModels(AuthResponseDto)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    return this.authService.login(loginDto, tenantSchema);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    return this.authService.register(registerDto, tenantSchema);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  async me(@Req() req: Request) {
    const tenantSchema = (req as any).tenantSchema || 'tenant_demo';
    const userId = (req as any).user?.sub;
    return this.authService.validateUser(userId, tenantSchema);
  }
}
