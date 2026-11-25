import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeesService } from './fees.service';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateDefaulterDto } from './dto/update-defaulter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Fees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fees')
export class FeesController {
  constructor(private feesService: FeesService) {}

  @Post('heads')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a fee head' })
  createFeeHead(@Body() dto: CreateFeeHeadDto, @CurrentUser() actor: any) {
    return this.feesService.createFeeHead(dto, actor);
  }

  @Get('heads')
  @ApiOperation({ summary: 'Get fee heads with optional filters' })
  getFeeHeads(
    @CurrentUser() actor: any,
    @Query('classId') classId?: string,
    @Query('academicSessionId') academicSessionId?: string,
  ) {
    return this.feesService.getAllFeeHeads({ classId, academicSessionId }, actor);
  }

  @Post('payments')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Record a fee payment' })
  recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser() actor: any,
  ) {
    return this.feesService.recordPayment(dto, userId, actor);
  }

  @Get('payments/:studentId')
  @ApiOperation({ summary: 'Get all payments for a student' })
  getStudentPayments(@Param('studentId') studentId: string, @CurrentUser() actor: any) {
    return this.feesService.getStudentPayments(studentId, actor);
  }

  @Get('defaulters')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get defaulter records' })
  getDefaulters(
    @CurrentUser() actor: any,
    @Query('status') status?: string,
    @Query('academicSessionId') academicSessionId?: string,
  ) {
    return this.feesService.getDefaulters({ status, academicSessionId }, actor);
  }

  @Patch('defaulters/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Update defaulter record status' })
  updateDefaulter(
    @Param('id') id: string,
    @Body() dto: UpdateDefaulterDto,
    @CurrentUser() actor: any,
  ) {
    return this.feesService.updateDefaulterStatus(id, dto, actor);
  }
}
