import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@irisine.demo' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, enum: ['SUPER_ADMIN', 'IT_ADMIN', 'FACULTY', 'STUDENT'], description: 'Optional: portal the user is signing in to. The server checks it against the real role.' })
  @IsOptional()
  @IsIn(['SUPER_ADMIN', 'IT_ADMIN', 'FACULTY', 'STUDENT'])
  portal?: 'SUPER_ADMIN' | 'IT_ADMIN' | 'FACULTY' | 'STUDENT';
}
