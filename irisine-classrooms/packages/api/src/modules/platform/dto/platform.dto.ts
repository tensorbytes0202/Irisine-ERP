import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUrl,
  Length, MaxLength, MinLength, ValidateNested,
} from 'class-validator';

export class SubmitRegistrationDto {
  @IsString() @Length(2, 150) schoolName: string;
  @IsEmail() @MaxLength(150) email: string;
  @IsString() @Length(5, 20) phone: string;
  @IsString() @Length(3, 300) address: string;
  @IsString() @Length(2, 80) city: string;
  @IsString() @Length(2, 80) state: string;
  @IsString() @Length(2, 80) country: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsString() @Length(2, 100) contactPerson: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) requestedFeatures?: string[];
}

export class FeatureGrantDto {
  @IsString() key: string;
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsBoolean() adminManageable?: boolean;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class ApproveRegistrationDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => FeatureGrantDto)
  features: FeatureGrantDto[];
}

export class RejectRegistrationDto {
  @IsString() @Length(3, 500) reason: string;
}

export class SetFeaturesDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => FeatureGrantDto)
  features: FeatureGrantDto[];
}

export class SetStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']) status: string;
}

export class PlatformLoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) @MaxLength(100) password: string;
}

export class ToggleFeatureDto {
  @IsBoolean() enabled: boolean;
}
