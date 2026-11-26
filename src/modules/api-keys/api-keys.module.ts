import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PrismaModule } from '../../infrastructure/database/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService, ApiKeyGuard, JwtModule],
})
export class ApiKeysModule {}
