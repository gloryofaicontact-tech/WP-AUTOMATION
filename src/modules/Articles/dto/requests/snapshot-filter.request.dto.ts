import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { WorkflowStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class SnapshotFilterRequestDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  websiteId?: string;

  @IsOptional()
  @IsUUID()
  contentTypeId?: string;

  @IsOptional()
  @IsEnum(WorkflowStatus)
  workflowStatus?: WorkflowStatus;
}
