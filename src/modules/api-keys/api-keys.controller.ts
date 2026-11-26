import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ResponseMessage('API keys retrieved successfully')
  async findAll(@CurrentUser() user: RequestUser) {
    return this.apiKeysService.findAll(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('MCP connection key generated successfully')
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.id, dto.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('API key revoked successfully')
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.apiKeysService.revoke(id, user.id);
  }
}
