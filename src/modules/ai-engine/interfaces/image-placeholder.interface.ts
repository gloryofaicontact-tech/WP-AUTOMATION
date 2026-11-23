export interface ImagePlaceholder {
  placeholderId: string;
  position: 'featured_hero' | 'after_h2_1' | 'after_h2_2' | 'after_h2_3' | 'content_middle' | 'content_end';
  recommendedSearch: string;
  altText: string;
  targetHeading?: string;
}
