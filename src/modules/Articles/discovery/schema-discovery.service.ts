import { Injectable, Logger } from '@nestjs/common';
import { ContentTypeSchemaStatus } from '@prisma/client';

export interface DiscoveredSchemaResult {
  schema: Record<string, any>;
  schemaStatus: ContentTypeSchemaStatus;
}

@Injectable()
export class SchemaDiscoveryService {
  private readonly logger = new Logger(SchemaDiscoveryService.name);

  /**
   * Inspects a post type's REST API endpoint via an OPTIONS request.
   * Discovers field properties, types, meta schemas, and ACF exposures.
   */
  async inspect(
    url: string,
    restNamespace: string,
    restBase: string,
    authHeader: string,
  ): Promise<DiscoveredSchemaResult> {
    const endpoint = `${url}/wp-json/${restNamespace}/${restBase}`;

    try {
      const response = await fetch(endpoint, {
        method: 'OPTIONS',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        this.logger.warn(`OPTIONS request to ${endpoint} returned HTTP ${response.status}`);
        return {
          schema: {},
          schemaStatus: ContentTypeSchemaStatus.UNAVAILABLE,
        };
      }

      const data = await response.json();
      const schema = data.schema || {};
      const properties: Record<string, any> = schema.properties || {};

      // Check schema completeness
      const hasTitle = 'title' in properties;
      const hasContent = 'content' in properties;
      const hasMeta = 'meta' in properties && typeof properties.meta === 'object';
      const hasAcf = 'acf' in properties;

      let schemaStatus: ContentTypeSchemaStatus = ContentTypeSchemaStatus.PARTIALLY_DISCOVERED;

      if ((hasMeta && Object.keys(properties.meta.properties || {}).length > 0) || hasAcf) {
        // Detailed custom fields or ACF are exposed in REST schema
        schemaStatus = ContentTypeSchemaStatus.FULLY_DISCOVERED;
      } else if (hasTitle || hasContent) {
        schemaStatus = ContentTypeSchemaStatus.PARTIALLY_DISCOVERED;
      }

      // Simplify schema representation for storage
      const simplifiedProperties: Record<string, any> = {};
      for (const [propName, propDef] of Object.entries(properties)) {
        simplifiedProperties[propName] = {
          type: propDef.type,
          description: propDef.description || null,
          readonly: Boolean(propDef.readonly),
          context: propDef.context || [],
        };

        if (propName === 'meta' && propDef.properties) {
          simplifiedProperties[propName].fields = Object.keys(propDef.properties);
        }

        if (propName === 'acf' && propDef.properties) {
          simplifiedProperties[propName].fields = Object.keys(propDef.properties);
        }
      }

      return {
        schema: {
          title: schema.title || restBase,
          properties: simplifiedProperties,
        },
        schemaStatus,
      };
    } catch (err: any) {
      this.logger.warn(`Schema inspection failed for ${endpoint}: ${err.message}`);
      return {
        schema: {},
        schemaStatus: ContentTypeSchemaStatus.UNAVAILABLE,
      };
    }
  }
}
