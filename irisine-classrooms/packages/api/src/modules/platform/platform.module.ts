import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { FeaturesService } from './features.service';
import { FeatureGuard } from './feature.guard';
import { PlatformService } from './platform.service';
import { OnboardingService } from './onboarding.service';
import { LimitsService } from './limits.service';
import { InvitesService } from './invites.service';
import { TenantService } from './tenant.service';
import { PlatformController, PlatformPublicController, SchoolFeaturesController } from './platform.controller';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PlatformPublicController, PlatformController, SchoolFeaturesController],
  providers: [
    FeaturesService,
    PlatformService,
    OnboardingService,
    LimitsService,
    InvitesService,
    TenantService,
    FeatureGuard,
    { provide: APP_GUARD, useExisting: FeatureGuard },
  ],
  exports: [FeaturesService, InvitesService, TenantService, LimitsService],
})
export class PlatformModule {}
