import {
  Body, Controller, Get, Headers, HttpCode, Param, Post, Query, RawBodyRequest, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  // Razorpay calls this; it is authenticated by its signature, not a JWT.
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Razorpay webhook (signature verified)' })
  webhook(
    @Req() req: RawBodyRequest<any>,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    return this.payments.handleWebhook(req.rawBody as Buffer, signature, eventId);
  }

  @Post('create-order')
  @ApiBearerAuth()
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Roles('PARENT', 'STUDENT')
  @ApiOperation({ summary: 'Create a Razorpay order for a fee' })
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
    return this.payments.createOrder(dto, user);
  }

  @Post('verify')
  @ApiBearerAuth()
  @UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Roles('PARENT', 'STUDENT')
  @ApiOperation({ summary: 'Verify a Razorpay payment signature and record it' })
  verify(@Body() dto: VerifyPaymentDto, @CurrentUser() user: any) {
    return this.payments.verifyPayment(dto, user);
  }

  @Get('dues')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fee dues for the students the user may see' })
  dues(@CurrentUser() user: any, @Query('studentId') studentId?: string) {
    return this.payments.getDues(user, studentId);
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Payment history (own children, or all for admins)' })
  history(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.payments.getHistory(user, { status, studentId });
  }

  @Get('receipt/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Receipt for a paid order' })
  receipt(@Param('id') id: string, @CurrentUser() user: any) {
    return this.payments.getReceipt(id, user);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'One payment order' })
  one(@Param('id') id: string, @CurrentUser() user: any) {
    return this.payments.getOne(id, user);
  }
}
