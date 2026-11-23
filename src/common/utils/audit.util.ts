export interface AuditLogData {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: unknown;
  ipAddress?: string | null;
}

/**
 * Writes a single audit log entry inside a Prisma transaction or client.
 */
export async function logAudit(tx: any, data: AuditLogData): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: data.userId ?? null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      details: data.details,
      ipAddress: data.ipAddress,
    },
  });
}
