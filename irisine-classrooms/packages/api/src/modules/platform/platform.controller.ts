import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlatformOwnerGuard } from './platform-owner.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import { OnboardingService } from './onboarding.service';
import { LimitsService } from './limits.service';
import { SchoolProfileService } from './school-profile.service';
import { UpdateSchoolProfileDto } from './dto/school-profile.dto';
import { FeaturesService } from './features.service';
import { CreateSchoolDto, SetFeaturesDto, SetLimitsDto, SetStatusDto, ToggleFeatureDto } from './dto/platform.dto';

/** Platform owner only (see auth/platform-owner.ts). Everyone else, other IT admins included, gets 403. */
@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PlatformOwnerGuard)
@Roles('IT_ADMIN')
@Controller('platform')
export class PlatformController {
  constructor(
    private platform: PlatformService,
    private onboarding: OnboardingService,
    private limits: LimitsService,
    private features: FeaturesService,
  ) {}

  @Get('stats') stats() { return this.platform.stats(); }

  @Get('features') catalog() { return this.features.listCatalog(); }

  @Post('schools')
  createSchool(@Body() dto: CreateSchoolDto, @CurrentUser('sub') by: string) {
    return this.onboarding.createSchool(dto, by);
  }

  @Get('schools') listSchools(@Query('status') status?: string) { return this.platform.listSchools(status); }
  @Get('schools/:id') getSchool(@Param('id') id: string) { return this.platform.getSchool(id); }
  @Get('schools/:id/usage') usage(@Param('id') id: string) { return this.limits.usage(id); }
  @Get('schools/:id/people') people(@Param('id') id: string) { return this.platform.people(id); }

  @Patch('schools/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto, @CurrentUser('schoolId') own: string) {
    return this.platform.setSchoolStatus(id, dto.status, own);
  }

  @Delete('schools/:id')
  deleteSchool(@Param('id') id: string, @CurrentUser('schoolId') own: string) {
    return this.platform.deleteSchool(id, own);
  }

  @Patch('schools/:id/limits')
  setLimits(@Param('id') id: string, @Body() dto: SetLimitsDto) {
    return this.limits.setLimits(id, dto);
  }

  @Put('schools/:id/features')
  setFeatures(@Param('id') id: string, @Body() dto: SetFeaturesDto, @CurrentUser('sub') by: string) {
    return this.features.setSchoolFeatures(id, dto.features, by);
  }

  @Post('schools/:id/resend-invite')
  resend(@Param('id') id: string) { return this.onboarding.resendInvite(id); }
}

/** A school's own admins: see what is enabled, switch what the platform allowed. */
@ApiTags('School features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('school')
export class SchoolFeaturesController {
  constructor(
    private features: FeaturesService,
    private profile: SchoolProfileService,
  ) {}

  @Get('profile')
  @Roles('SUPER_ADMIN', 'ADMIN', 'IT_ADMIN')
  getProfile(@CurrentUser('schoolId') schoolId: string) {
    return this.profile.get(schoolId);
  }

  @Patch('profile')
  @Roles('SUPER_ADMIN', 'ADMIN', 'IT_ADMIN')
  updateProfile(@Body() dto: UpdateSchoolProfileDto, @CurrentUser('schoolId') schoolId: string) {
    return this.profile.update(schoolId, dto);
  }

  @Get('modules')
  @Roles('SUPER_ADMIN', 'ADMIN', 'IT_ADMIN')
  modules(@CurrentUser('schoolId') schoolId: string) {
    return this.features.grantedModules(schoolId);
  }

  @Get('features')
  mine(@CurrentUser('schoolId') schoolId: string) {
    return this.features.myFeatures(schoolId);
  }

  @Patch('features/:key')
  @Roles('SUPER_ADMIN', 'ADMIN', 'IT_ADMIN')
  toggle(@Param('key') key: string, @Body() dto: ToggleFeatureDto, @CurrentUser('schoolId') schoolId: string) {
    return this.features.adminToggle(schoolId, key, dto.enabled);
  }
}
