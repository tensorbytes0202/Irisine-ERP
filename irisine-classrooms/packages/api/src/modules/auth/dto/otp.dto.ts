import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: ['RESET'], default: 'RESET' })
  @IsOptional()
  @IsIn(['RESET'])
  purpose?: 'RESET';
}

export class VerifyOtpDto extends SendOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  otp: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(100)
  resetToken: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
