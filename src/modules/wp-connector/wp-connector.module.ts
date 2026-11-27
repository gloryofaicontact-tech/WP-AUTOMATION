import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WpConnectorService } from './wp-connector.service';
import { WpConnectorController } from './wp-connector.controller';
import { WebsitesModule } from '../websites/websites.module';
import { ArticlesModule } from '../Articles/articles.module';

@Module({
  imports: [WebsitesModule, ArticlesModule, JwtModule.register({})],
  controllers: [WpConnectorController],
  providers: [WpConnectorService],
  exports: [WpConnectorService],
})
export class WpConnectorModule {}
