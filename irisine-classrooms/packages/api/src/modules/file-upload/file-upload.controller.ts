import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileUploadService } from './file-upload.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { randomUUID } from 'crypto';
import * as path from 'path';

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx',
  'mp4', 'mp3',
  'jpg', 'jpeg', 'png', 'gif', 'webp',
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

/** Every school's files live under its own folder. Clients only ever see paths inside it. */
const folderOf = (schoolId: string) => `schools/${schoolId}/`;
function inside(schoolId: string, name = '') {
  if (name.startsWith('/') || name.split(/[\\/]/).includes('..')) throw new BadRequestException('Invalid file path');
  return folderOf(schoolId) + name;
}
const shortName = (schoolId: string, name: string) => name.slice(folderOf(schoolId).length);

@ApiTags('File Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file to MinIO (organised storage)' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'folder', required: false, description: 'Optional subfolder prefix, e.g. class-10/math/videos' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadFile(
    @CurrentUser('schoolId') schoolId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File exceeds the 2 GB limit');
    }

    // Validate extension
    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        `File type ".${ext}" is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      );
    }

    const uniqueName = `${folder ? folder.replace(/\/$/, '') + '/' : ''}${randomUUID()}.${ext}`;

    const url = await this.fileUploadService.uploadFile(file.buffer, inside(schoolId, uniqueName), file.mimetype);

    return {
      success: true,
      fileName: uniqueName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
    };
  }

  @Get('browse')
  @ApiOperation({ summary: 'Browse files by folder prefix (non-recursive)' })
  @ApiQuery({ name: 'prefix', required: false, description: 'Folder prefix, e.g. class-10/math/videos/' })
  async browseFiles(@CurrentUser('schoolId') schoolId: string, @Query('prefix') prefix?: string) {
    const result = await this.fileUploadService.listByFolder(inside(schoolId, prefix));
    return {
      prefix: prefix ?? '',
      folders: result.folders.map((f) => shortName(schoolId, f)),
      files: result.files.map((f) => ({
        name: shortName(schoolId, f.name!),
        size: f.size,
        lastModified: f.lastModified,
        etag: f.etag,
      })),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Storage statistics: total files, total size, breakdown by type' })
  async getStorageStats(@CurrentUser('schoolId') schoolId: string) {
    return this.fileUploadService.getStorageStats(inside(schoolId));
  }

  @Get()
  @ApiOperation({ summary: 'List all files in bucket (recursive)' })
  async listFiles(@CurrentUser('schoolId') schoolId: string, @Query('prefix') prefix?: string) {
    const files = await this.fileUploadService.listFiles(inside(schoolId, prefix));
    return {
      files: files.map((f) => ({
        name: shortName(schoolId, f.name!),
        size: f.size,
        lastModified: f.lastModified,
        etag: f.etag,
      })),
      total: files.length,
    };
  }

  @Get('info/:fileName(*)')
  @ApiOperation({ summary: 'Get metadata for a specific file' })
  async getFileInfo(@CurrentUser('schoolId') schoolId: string, @Param('fileName') fileName: string) {
    if (!fileName) throw new BadRequestException('File name is required');
    const key = inside(schoolId, fileName);
    try {
      return { ...(await this.fileUploadService.getFileInfo(key)), name: fileName };
    } catch {
      throw new NotFoundException(`File "${fileName}" not found`);
    }
  }

  @Get(':fileName(*)')
  @ApiOperation({ summary: 'Get signed download URL for a file' })
  async getSignedUrl(@CurrentUser('schoolId') schoolId: string, @Param('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('File name is required');
    }
    const key = inside(schoolId, fileName);

    try {
      const url = await this.fileUploadService.getSignedUrl(key);
      return { fileName, signedUrl: url };
    } catch {
      throw new NotFoundException(`File "${fileName}" not found`);
    }
  }

  @Delete(':fileName(*)')
  @ApiOperation({ summary: 'Delete a file from MinIO' })
  async deleteFile(@CurrentUser('schoolId') schoolId: string, @Param('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('File name is required');
    }

    await this.fileUploadService.deleteFile(inside(schoolId, fileName));
    return { success: true, message: `File "${fileName}" deleted successfully` };
  }
}
