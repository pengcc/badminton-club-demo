import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { AuditService } from '../services/auditService';
import type { AuditEventType, EntityType } from '@club/shared-types/core/enums';

/**
 * Controller for Audit Log operations
 * Admin-only access for viewing audit trails
 */
export class AuditController {
  /**
   * GET /api/audit
   * Get audit logs with filtering and pagination
   * Admin only
   */
  static async getLogs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        eventType,
        entityType,
        entityId,
        actorId,
        startDate,
        endDate,
        limit,
        offset,
      } = req.query;

      // Parse event types (can be comma-separated)
      const eventTypes = eventType
        ? (eventType as string)
            .split(',')
            .map((t) => t.trim() as AuditEventType)
        : undefined;

      // Parse entity types (can be comma-separated)
      const entityTypes = entityType
        ? (entityType as string).split(',').map((t) => t.trim() as EntityType)
        : undefined;

      const result = await AuditService.getLogs({
        eventType:
          eventTypes && eventTypes.length === 1 ? eventTypes[0] : eventTypes,
        entityType:
          entityTypes && entityTypes.length === 1
            ? entityTypes[0]
            : entityTypes,
        entityId: entityId as string,
        actorId: actorId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/:id
   * Get a single audit log by ID
   * Admin only
   */
  static async getLogById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const log = await AuditService.getLogById(id);

      if (!log) {
        res.status(404).json({
          success: false,
          error: 'Audit log not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: log,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/entity/:type/:id
   * Get audit history for a specific entity
   * Admin only
   */
  static async getEntityHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { type, id } = req.params;
      const { limit } = req.query;

      const logs = await AuditService.getLogsForEntity(
        type as EntityType,
        id,
        limit ? parseInt(limit as string, 10) : undefined
      );

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }
}
