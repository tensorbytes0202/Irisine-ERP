import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, MaxLength,
  Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';

export class FeatureGrantDto {
  @IsString() key: string;
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsBoolean() adminManageable?: boolean;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class CreateSchoolDto {
  @IsString() @Length(2, 150) schoolName: string;
  @IsString() @Length(2, 100) adminName: string;
  @IsEmail() @MaxLength(150) adminEmail: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) maxStudents?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) maxFaculty?: number | null;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => FeatureGrantDto)
  features: FeatureGrantDto[];
}

export class SetLimitsDto {
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsInt() @Min(0) @Max(1000000) maxStudents?: number | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsInt() @Min(0) @Max(1000000) maxFaculty?: number | null;
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
