import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { WebsitesModule } from '../websites/websites.module';
import { ArticlesModule } from '../Articles/articles.module';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { MediaDiscoveryModule } from '../media-discovery/media-discovery.module';
import { WpPublisherService } from './services/wp-publisher.service';
import { ArticlesManagerService } from './articles-manager.service';
import { ArticlesManagerController } from './articles-manager.controller';

@Module({
  imports: [
    PrismaModule,
    WebsitesModule,
    ArticlesModule,
    AiEngineModule,
    MediaDiscoveryModule,
  ],
  controllers: [ArticlesManagerController],
  providers: [WpPublisherService, ArticlesManagerService],
  exports: [ArticlesManagerService],
})
export class ArticlesManagerModule {}
