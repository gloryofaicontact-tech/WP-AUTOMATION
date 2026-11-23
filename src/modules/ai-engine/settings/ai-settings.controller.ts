import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { UpdateAiSettingsDto } from '../dto/update-ai-settings.dto';
import { TestAiKeyDto } from '../dto/test-ai-key.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequestUser } from '../../../common/interfaces/request-user.interface';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { UserRole } from '@prisma/client';

@Controller('settings/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  /**
   * Retrieves active AI settings, masked keys, and configured models.
   */
  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR)
  @ResponseMessage('AI settings retrieved successfully')
  async getSettings() {
    return this.aiSettingsService.getSettings();
  }

  /**
   * Updates active AI provider and/or API keys.
   */
  @Put()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ResponseMessage('AI settings updated successfully')
  async updateSettings(
    @Body() dto: UpdateAiSettingsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.aiSettingsService.updateSettings(dto, user.id);
  }

  /**
   * Tests an AI provider key by sending a live ping prompt.
   */
  @Post('test')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('AI key connection tested')
  async testKey(@Body() dto: TestAiKeyDto) {
    return this.aiSettingsService.testKey(dto);
  }
}
