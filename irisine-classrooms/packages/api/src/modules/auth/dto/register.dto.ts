import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'My School' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  schoolName: string;

  @ApiProperty({ example: 'Asha' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Verma' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Choose a strong password' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
