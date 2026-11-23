import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ContentSnapshotService } from '../snapshots/content-snapshot.service';
import { SnapshotFilterRequestDto } from '../dto/requests/snapshot-filter.request.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequestUser } from '../../../common/interfaces/request-user.interface';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import { UserRole } from '@prisma/client';

@Controller('articles/snapshots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SnapshotsController {
  constructor(private readonly snapshotService: ContentSnapshotService) {}

  /**
   * Lists all content snapshots currently in the enhancement workflow with pagination.
   */
  @Get()
  @ResponseMessage('Content snapshots retrieved successfully')
  async listSnapshots(@Query() query: SnapshotFilterRequestDto) {
    return this.snapshotService.listSnapshots(
      { page: query.page, limit: query.limit },
      {
        websiteId: query.websiteId,
        contentTypeId: query.contentTypeId,
        workflowStatus: query.workflowStatus,
      },
    );
  }

  /**
   * Retrieves single snapshot details by its UUID.
   */
  @Get(':id')
  @ResponseMessage('Content snapshot details retrieved successfully')
  async getSnapshotById(@Param('id', ParseUUIDPipe) id: string) {
    return this.snapshotService.getSnapshotById(id);
  }

  /**
   * Removes a content snapshot from the workflow.
   */
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ResponseMessage('Content snapshot removed from workflow')
  async deleteSnapshot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.snapshotService.deleteSnapshot(id, user.id);
  }
}
