import { Module } from '@nestjs/common';
import { WebsitesService } from './websites.service';
import { WebsitesController } from './websites.controller';
import { WordPressClientService } from './wordpress-client.service';

@Module({
  controllers: [WebsitesController],
  providers: [WebsitesService, WordPressClientService],
  exports: [WebsitesService, WordPressClientService],
})
export class WebsitesModule {}
