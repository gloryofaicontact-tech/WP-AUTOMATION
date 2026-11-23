import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WebsitesService } from './websites.service';
import { CreateWebsiteRequestDto } from './dto/requests/create-website.request.dto';
import { UpdateWebsiteRequestDto } from './dto/requests/update-website.request.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { UserRole } from '@prisma/client';

@Controller('websites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebsitesController {
  constructor(private readonly websitesService: WebsitesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('WordPress website connected successfully')
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWebsiteRequestDto,
  ) {
    return this.websitesService.create(dto, user.id);
  }

  @Get()
  @ResponseMessage('Websites retrieved successfully')
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.websitesService.findAll(paginationDto);
  }

  @Get(':id')
  @ResponseMessage('Website details retrieved successfully')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.websitesService.findById(id);
  }

  @Post(':id/test-connection')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('WordPress connection test completed')
  async testConnection(@Param('id', ParseUUIDPipe) id: string) {
    return this.websitesService.testConnection(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ResponseMessage('Website updated successfully')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebsiteRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.websitesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ResponseMessage('Website removed successfully')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.websitesService.remove(id, user.id);
  }
}
