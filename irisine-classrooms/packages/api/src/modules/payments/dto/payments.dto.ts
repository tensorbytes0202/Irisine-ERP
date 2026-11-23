import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  studentId: string;

  @ApiProperty()
  @IsString()
  feeHeadId: string;

  @ApiPropertyOptional({ description: 'Rupees, up to 2 decimals. Omit to pay the full outstanding amount.', example: '2500.00' })
  @IsOptional()
  @Matches(/^\d{1,8}(\.\d{1,2})?$/, { message: 'amount must be a valid rupee amount' })
  amount?: string;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  razorpay_order_id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  razorpay_payment_id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(256)
  razorpay_signature: string;
}
