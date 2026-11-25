export interface DiscoveredImageAsset {
  id: string;
  title: string;
  previewUrl: string;
  sourceUrl: string;
  elementsSearchUrl?: string;
  downloadUrl: string;
  author: string;
  width?: number;
  height?: number;
  isLicensed?: boolean;
  provider: 'envato' | 'unsplash' | 'pexels' | 'stock' | 'wordpress';
}

export interface MatchedImagePlaceholder {
  placeholderId: string;
  position: 'featured_hero' | 'after_h2_1' | 'after_h2_2' | 'after_h2_3' | 'content_middle' | 'content_end';
  recommendedSearch: string;
  fallbackSearch?: string;
  elementsSearchUrl?: string;
  isPreviewOnly?: boolean;
  altText: string;
  targetHeading?: string;
  selectedAsset: DiscoveredImageAsset;
  alternativeOptions: DiscoveredImageAsset[];
}
