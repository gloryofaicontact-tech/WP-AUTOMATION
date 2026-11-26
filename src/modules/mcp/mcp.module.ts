import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { WebsitesModule } from '../websites/websites.module';
import { ArticlesModule } from '../Articles/articles.module';
import { ArticlesManagerModule } from '../articles-manager/articles-manager.module';

@Module({
  imports: [ApiKeysModule, WebsitesModule, ArticlesModule, ArticlesManagerModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
