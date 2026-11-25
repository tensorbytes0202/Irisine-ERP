import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'IT_ADMIN')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: any) {
    return this.usersService.create(dto, actor);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'IT_ADMIN', 'DIRECTOR')
  findAll(@CurrentUser('schoolId') schoolId: string, @Query('role') role?: string) {
    return this.usersService.findAll(schoolId, role);
  }

  @Get('me')
  getProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.findById(userId);
  }

  /** Anyone may edit their own name and phone. Declared before ':id'. */
  @Patch('me')
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser('sub') userId: string) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.usersService.findInSchool(id, schoolId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'IT_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: any) {
    return this.usersService.update(id, dto, actor);
  }
}
