import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import { RegistrationsService } from './registrations.service';
import { FeaturesService } from './features.service';
import {
  ApproveRegistrationDto, PlatformLoginDto, RejectRegistrationDto, SetFeaturesDto, SetStatusDto,
  SubmitRegistrationDto, ToggleFeatureDto,
} from './dto/platform.dto';

/** Public: school registration request + platform owner login. */
@ApiTags('Platform (public)')
@UseGuards(ThrottlerGuard)
@Controller('platform-public')
export class PlatformPublicController {
  constructor(private platform: PlatformService, private registrations: RegistrationsService) {}

  @Post('school-registrations')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  submit(@Body() dto: SubmitRegistrationDto) {
    return this.registrations.submit(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: PlatformLoginDto) {
    return this.platform.login(dto.email, dto.password);
  }
}

/** Platform owner only. A school user (even a school SUPER_ADMIN) gets 403 here. */
@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLATFORM_SUPER_ADMIN')
@Controller('platform')
export class PlatformController {
  constructor(
    private platform: PlatformService,
    private registrations: RegistrationsService,
    private features: FeaturesService,
  ) {}

  @Get('stats') stats() { return this.platform.stats(); }

  @Get('features') catalog() { return this.features.listCatalog(); }

  @Get('registrations') listRequests(@Query('status') status?: string) { return this.registrations.list(status); }
  @Get('registrations/:id') getRequest(@Param('id') id: string) { return this.registrations.get(id); }

  @Post('registrations/:id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveRegistrationDto, @CurrentUser('sub') by: string) {
    return this.registrations.approve(id, dto.features, by);
  }

  @Post('registrations/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectRegistrationDto, @CurrentUser('sub') by: string) {
    return this.registrations.reject(id, dto.reason, by);
  }

  @Get('schools') listSchools(@Query('status') status?: string) { return this.platform.listSchools(status); }
  @Get('schools/:id') getSchool(@Param('id') id: string) { return this.platform.getSchool(id); }

  @Patch('schools/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.platform.setSchoolStatus(id, dto.status);
  }

  @Put('schools/:id/features')
  setFeatures(@Param('id') id: string, @Body() dto: SetFeaturesDto, @CurrentUser('sub') by: string) {
    return this.features.setSchoolFeatures(id, dto.features, by);
  }

  @Post('schools/:id/resend-invite')
  resend(@Param('id') id: string) { return this.registrations.resendInvite(id); }
}

/** A school's own admins: see what is enabled, switch what the platform allowed. */
@ApiTags('School features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('school')
export class SchoolFeaturesController {
  constructor(private features: FeaturesService) {}

  @Get('features')
  mine(@CurrentUser('schoolId') schoolId: string) {
    return this.features.myFeatures(schoolId);
  }

  @Patch('features/:key')
  @Roles('SUPER_ADMIN', 'IT_ADMIN')
  toggle(@Param('key') key: string, @Body() dto: ToggleFeatureDto, @CurrentUser('schoolId') schoolId: string) {
    return this.features.adminToggle(schoolId, key, dto.enabled);
  }
}
