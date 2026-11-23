import { Controller, Get, Post, Delete, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    @HttpCode(HttpStatus.OK)
    async findAll(
        @CurrentUser() user: RequestUser,
        @Query() paginationDto: PaginationDto,
    ) {
        return this.notificationsService.findAll(BigInt(user.sub || user.id), paginationDto);
    }

    @Post('read-all')
    @HttpCode(HttpStatus.OK)
    async markAllAsRead(@CurrentUser() user: RequestUser) {
        return this.notificationsService.markAllAsRead(BigInt(user.sub || user.id));
    }

    @Post('read/:notificationId')
    @HttpCode(HttpStatus.OK)
    async markAsRead(@CurrentUser() user: RequestUser, @Param('notificationId') notificationId: string) {
        return this.notificationsService.markAsRead(notificationId, BigInt(user.sub || user.id));
    }

    @Delete('delete/:notificationId')
    @HttpCode(HttpStatus.OK)
    async remove(@CurrentUser() user: RequestUser, @Param('notificationId') notificationId: string) {
        return this.notificationsService.remove(notificationId, BigInt(user.sub || user.id));
    }
}