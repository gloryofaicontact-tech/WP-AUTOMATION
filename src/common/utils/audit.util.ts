import { RiskLevel } from '@prisma/client';

/**
 * Input for the shared logAudit helper.
 */
export interface AuditLogData {
  userId: bigint | null;
  action: string;
  entity: string;
  entityId: string;
  ipAddress: string;
  userAgent?: string | null;
  requestId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  riskLevel?: RiskLevel;
  metadata?: unknown;
}

/**
 * Writes a single audit log entry inside a Prisma transaction.
 * Use from services: await logAudit(tx, { userId, action, entity, entityId, ipAddress, oldValues, newValues }).
 *
 * @param tx - Prisma transaction client (from prisma.$transaction)
 * @param data - Audit fields (entity, entityId, ipAddress required)
 */
export async function logAudit(tx: any, data: AuditLogData): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent ?? undefined,
      requestId: data.requestId ?? undefined,
      riskLevel: data.riskLevel ?? RiskLevel.LOW,
      oldValues: data.oldValues ?? undefined,
      newValues: data.newValues ?? undefined,
      metadata: data.metadata ?? undefined,
    },
  });
}
