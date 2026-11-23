import { Module } from '@nestjs/common';
import { WebsitesModule } from '../websites/websites.module';
import { PostTypeDiscoveryService } from './discovery/post-type-discovery.service';
import { TaxonomyDiscoveryService } from './discovery/taxonomy-discovery.service';
import { SchemaDiscoveryService } from './discovery/schema-discovery.service';
import { ContentTypeService } from './registry/content-type.service';
import { ContentRetrievalService } from './retrieval/content-retrieval.service';
import { ContentSnapshotService } from './snapshots/content-snapshot.service';
import { ContentController } from './controllers/content.controller';
import { SnapshotsController } from './controllers/snapshots.controller';

@Module({
  imports: [WebsitesModule],
  controllers: [ContentController, SnapshotsController],
  providers: [
    PostTypeDiscoveryService,
    TaxonomyDiscoveryService,
    SchemaDiscoveryService,
    ContentTypeService,
    ContentRetrievalService,
    ContentSnapshotService,
  ],
  exports: [
    ContentTypeService,
    ContentRetrievalService,
    ContentSnapshotService,
  ],
})
export class ArticlesModule {}
