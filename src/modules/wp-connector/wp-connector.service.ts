import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { WebsitesService } from '../websites/websites.service';
import { ContentTypeService } from '../Articles/registry/content-type.service';
import { PluginConnectDto } from './dto/plugin-connect.dto';

@Injectable()
export class WpConnectorService {
  private readonly logger = new Logger(WpConnectorService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly websitesService: WebsitesService,
    private readonly contentTypeService: ContentTypeService,
  ) {}

  /**
   * Generates a short-lived (10-minute) Connect Token bound to the authenticated user.
   */
  async createConnectToken(userId: string) {
    const secret = this.configService.get<string>('jwt.secret') || process.env.JWT_SECRET;
    const expiresInSeconds = 600;

    const connectToken = await this.jwtService.signAsync(
      { sub: userId, purpose: 'wp_plugin_connect' },
      { secret, expiresIn: expiresInSeconds },
    );

    const appUrl = (
      this.configService.get<string>('app.appUrl') ||
      process.env.APP_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
    const apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api/v1';

    return {
      connectToken,
      expiresInSeconds,
      connectEndpoint: `${appUrl}/${apiPrefix}/wp-connector/connect`,
      downloadUrl: `${appUrl}/${apiPrefix}/wp-connector/plugin/download`,
    };
  }

  /**
   * Called by the WordPress plugin to register the site and auto-discover content types.
   */
  async connectFromPlugin(dto: PluginConnectDto) {
    const secret = this.configService.get<string>('jwt.secret') || process.env.JWT_SECRET;

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.connectToken, { secret });
    } catch {
      throw new UnauthorizedException(
        'Connect token is invalid or expired. Generate a new one in WP-Automation.',
      );
    }

    if (!payload?.sub || payload?.purpose !== 'wp_plugin_connect') {
      throw new UnauthorizedException('Invalid connect token purpose.');
    }

    const userId = String(payload.sub);

    // Register & validate the WordPress site via WebsitesService
    const website = await this.websitesService.create(
      {
        name: dto.name,
        url: dto.url,
        username: dto.username,
        applicationPassword: dto.applicationPassword,
      } as any,
      userId,
    );

    // Auto-discover post types, taxonomies, and layout blueprints
    let discoveredCount = 0;
    try {
      const types = await this.contentTypeService.discoverAndSync(website.id, userId);
      discoveredCount = types.length;
    } catch (err: any) {
      this.logger.warn(
        `Website ${website.id} connected via plugin, but auto-discovery failed: ${err.message}`,
      );
    }

    return {
      connected: true,
      websiteId: website.id,
      name: website.name,
      url: website.url,
      status: website.status,
      discoveredContentTypes: discoveredCount,
    };
  }

  /**
   * Resolves the packaged WordPress plugin zip path from src/ (or dist/).
   */
  getPluginZipPath(): string {
    const candidates = [
      join(process.cwd(), 'src', 'modules', 'wp-connector', 'plugin', 'wp-automation-connector.zip'),
      join(__dirname, 'plugin', 'wp-automation-connector.zip'),
    ];

    for (const p of candidates) {
      if (existsSync(p)) {
        return p;
      }
    }

    throw new NotFoundException('WordPress connector plugin archive not found on server.');
  }
}
