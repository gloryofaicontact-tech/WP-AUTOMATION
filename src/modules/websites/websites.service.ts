import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { WordPressClientService } from './wordpress-client.service';
import { CreateWebsiteRequestDto } from './dto/requests/create-website.request.dto';
import { UpdateWebsiteRequestDto } from './dto/requests/update-website.request.dto';
import { WebsiteResponseDto } from './dto/responses/website.response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { encryptText, decryptText } from '../../common/utils/encryption.util';
import { logAudit } from '../../common/utils/audit.util';
import { WebsiteStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class WebsitesService {
  private readonly logger = new Logger(WebsitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wpClient: WordPressClientService,
  ) {}

  /**
   * Connects and registers a new WordPress website.
   * Immediately runs a connection test to verify credentials.
   */
  async create(dto: CreateWebsiteRequestDto, userId: string): Promise<WebsiteResponseDto> {
    const normalizedUrl = this.wpClient.normalizeUrl(dto.url);
    const restApiUrl = this.wpClient.getRestApiBase(normalizedUrl);

    // Test connection upfront — reject invalid/non-WordPress sites before saving
    const testResult = await this.wpClient.testConnection({
      url: normalizedUrl,
      username: dto.username,
      applicationPassword: dto.applicationPassword,
    });

    if (!testResult.success) {
      throw new BadRequestException(
        testResult.error ||
          'Could not connect to WordPress site. Please verify the URL, username, and Application Password.',
      );
    }

    const status = WebsiteStatus.CONNECTED;
    const lastError = null;
    const encryptedPassword = encryptText(dto.applicationPassword);

    const website = await this.prisma.website.create({
      data: {
        name: dto.name || testResult.siteName || normalizedUrl,
        url: normalizedUrl,
        restApiUrl,
        username: dto.username,
        applicationPassword: encryptedPassword,
        status,
        lastError,
        createdById: userId,
      },
    });

    await logAudit(this.prisma, {
      userId,
      action: 'WEBSITE_CONNECTED',
      entity: 'Website',
      entityId: website.id,
      details: {
        name: website.name,
        url: website.url,
        status: website.status,
      },
    });

    return plainToInstance(WebsiteResponseDto, website);
  }

  /**
   * Returns a paginated list of registered websites.
   */
  async findAll(paginationDto: PaginationDto) {
    const paginated = await paginate(this.prisma.website, paginationDto, {
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...paginated,
      data: paginated.data.map((item) => plainToInstance(WebsiteResponseDto, item)),
    };
  }

  /**
   * Retrieves single website details by ID.
   */
  async findById(id: string): Promise<WebsiteResponseDto> {
    const website = await this.prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      throw new NotFoundException(`Website with ID ${id} not found`);
    }

    return plainToInstance(WebsiteResponseDto, website);
  }

  /**
   * Re-tests live connection to WordPress and updates status.
   */
  async testConnection(id: string): Promise<{ success: boolean; message: string; details?: any }> {
    const website = await this.prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      throw new NotFoundException(`Website with ID ${id} not found`);
    }

    const decryptedPassword = decryptText(website.applicationPassword);
    const result = await this.wpClient.testConnection({
      url: website.url,
      username: website.username,
      applicationPassword: decryptedPassword,
    });

    const status = result.success ? WebsiteStatus.CONNECTED : WebsiteStatus.ERROR;
    const lastError = result.success ? null : (result.error || 'Connection failed');

    await this.prisma.website.update({
      where: { id },
      data: {
        status,
        lastError,
      },
    });

    return {
      success: result.success,
      message: result.success ? 'WordPress connection verified successfully.' : (result.error || 'Connection failed'),
      details: result.success ? { siteName: result.siteName, user: result.user } : undefined,
    };
  }

  /**
   * Updates website settings or credentials.
   */
  async update(id: string, dto: UpdateWebsiteRequestDto, userId: string): Promise<WebsiteResponseDto> {
    const website = await this.prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      throw new NotFoundException(`Website with ID ${id} not found`);
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.url !== undefined) {
      data.url = this.wpClient.normalizeUrl(dto.url);
      data.restApiUrl = this.wpClient.getRestApiBase(data.url);
    }

    if (dto.username !== undefined) {
      data.username = dto.username;
    }

    if (dto.applicationPassword) {
      data.applicationPassword = encryptText(dto.applicationPassword);
    }

    const updated = await this.prisma.website.update({
      where: { id },
      data,
    });

    await logAudit(this.prisma, {
      userId,
      action: 'WEBSITE_UPDATED',
      entity: 'Website',
      entityId: id,
      details: { updatedFields: Object.keys(data) },
    });

    return plainToInstance(WebsiteResponseDto, updated);
  }

  /**
   * Deletes a registered website.
   */
  async remove(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const website = await this.prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      throw new NotFoundException(`Website with ID ${id} not found`);
    }

    await this.prisma.website.delete({
      where: { id },
    });

    await logAudit(this.prisma, {
      userId,
      action: 'WEBSITE_DELETED',
      entity: 'Website',
      entityId: id,
      details: { name: website.name, url: website.url },
    });

    return { success: true, message: `Website '${website.name}' has been disconnected.` };
  }

  /**
   * Internal helper for other modules (e.g. ArticlesModule) to obtain decrypted credentials.
   */
  async getDecryptedCredentials(id: string): Promise<{
    url: string;
    restApiUrl: string;
    username: string;
    applicationPassword: string;
  }> {
    const website = await this.prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      throw new NotFoundException(`Website with ID ${id} not found`);
    }

    return {
      url: website.url,
      restApiUrl: website.restApiUrl || this.wpClient.getRestApiBase(website.url),
      username: website.username,
      applicationPassword: decryptText(website.applicationPassword),
    };
  }
}
