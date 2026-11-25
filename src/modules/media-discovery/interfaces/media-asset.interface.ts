export interface DiscoveredImageAsset {
  id: string;
  title: string;
  previewUrl: string;
  sourceUrl: string;
  downloadUrl: string;
  author: string;
  width?: number;
  height?: number;
  provider: 'envato' | 'unsplash' | 'pexels' | 'stock';
}

export interface MatchedImagePlaceholder {
  placeholderId: string;
  position: 'featured_hero' | 'after_h2_1' | 'after_h2_2' | 'after_h2_3' | 'content_middle' | 'content_end';
  recommendedSearch: string;
  fallbackSearch?: string;
  altText: string;
  targetHeading?: string;
  selectedAsset: DiscoveredImageAsset;
  alternativeOptions: DiscoveredImageAsset[];
}
