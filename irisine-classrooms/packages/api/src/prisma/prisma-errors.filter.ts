import { ArgumentsHost, Catch, ConflictException, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/** Database errors a user can cause become a clear answer instead of "Internal server error". */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrorsFilter extends BaseExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    // P2025: the row to change does not exist, or belongs to another school
    if (error.code === 'P2025') return super.catch(new NotFoundException('Record not found'), host);
    // P2002: a value that must be unique is taken
    if (error.code === 'P2002') {
      return super.catch(new ConflictException('A record with these details already exists'), host);
    }
    return super.catch(error, host);
  }
}
