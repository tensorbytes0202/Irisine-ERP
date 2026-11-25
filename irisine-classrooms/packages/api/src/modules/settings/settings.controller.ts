import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'IT_ADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings grouped by category' })
  findAll(@CurrentUser('schoolId') schoolId: string) {
    return this.settingsService.findAll(schoolId);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a single setting by key' })
  findOne(@Param('key') key: string, @CurrentUser('schoolId') schoolId: string) {
    return this.settingsService.findOne(key, schoolId);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a setting value' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.settingsService.update(key, dto, userId, schoolId);
  }

  @Post('seed-defaults')
  @ApiOperation({ summary: 'Seed default settings (skips existing keys)' })
  seedDefaults(
    @CurrentUser('schoolId') schoolId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.settingsService.seedDefaults(schoolId, userId);
  }
}
