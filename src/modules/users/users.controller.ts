import { Controller, Put, Delete, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { UpdateProfileRequestDto } from './dto/requests/update-profile.request.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Put('profile-update')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileRequestDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Delete('profile-delete')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: RequestUser) {
    return this.usersService.deleteAccount(user.id);
  }
}
