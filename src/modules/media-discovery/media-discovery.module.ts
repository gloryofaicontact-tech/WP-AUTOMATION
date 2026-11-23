import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvatoProvider } from './providers/envato.provider';
import { StockFallbackProvider } from './providers/stock-fallback.provider';
import { MediaDiscoveryService } from './media-discovery.service';

@Module({
  imports: [ConfigModule],
  providers: [EnvatoProvider, StockFallbackProvider, MediaDiscoveryService],
  exports: [MediaDiscoveryService],
})
export class MediaDiscoveryModule {}
