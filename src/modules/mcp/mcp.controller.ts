import { Controller, All, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { McpService } from './mcp.service';
import { RequestUser } from '../../common/interfaces/request-user.interface';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  /**
   * Remote MCP Streamable HTTP endpoint (stateless).
   * Accessible at `/mcp` (excluded from global `/api/v1` prefix).
   */
  @All()
  @Public()
  @UseGuards(ApiKeyGuard)
  async handleMcp(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user as RequestUser;
    const server = this.mcpService.createServerForUser(user);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
