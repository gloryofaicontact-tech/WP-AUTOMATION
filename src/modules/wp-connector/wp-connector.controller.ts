import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { WpConnectorService } from './wp-connector.service';
import { PluginConnectDto } from './dto/plugin-connect.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { UserRole } from '@prisma/client';

@Controller('wp-connector')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WpConnectorController {
  constructor(private readonly wpConnectorService: WpConnectorService) {}

  /**
   * Issues a short-lived 10-minute Connect Token for 1-click WordPress plugin onboarding.
   */
  @Post('token')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('WordPress connect token generated successfully')
  async generateConnectToken(@CurrentUser() user: RequestUser) {
    return this.wpConnectorService.createConnectToken(user.id);
  }

  /**
   * Handshake endpoint called by the WordPress connector plugin to register the site.
   */
  @Post('connect')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('WordPress site connected via plugin successfully')
  async connectFromPlugin(@Body() dto: PluginConnectDto) {
    return this.wpConnectorService.connectFromPlugin(dto);
  }

  /**
   * Downloads the ready-to-install wp-automation-connector.zip WordPress plugin.
   */
  @Get('plugin/download')
  @Public()
  async downloadPlugin(@Res() res: Response) {
    const zipPath = this.wpConnectorService.getPluginZipPath();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="wp-automation-connector.zip"',
    );
    createReadStream(zipPath).pipe(res);
  }
}
