import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Liveness/readiness probe for the load balancer. Public, and reveals nothing but up/down. */
@Controller('status')
export class StatusController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async status() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'down' });
    }
    return { status: 'ok' };
  }
}
