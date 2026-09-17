/**
 * Audit Service
 *
 * Handles all audit log-related data fetching
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '@app/lib/api/client';

export interface AuditLog {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorAccountKind: 'person' | 'super_admin';
  actorDisplayName: string;
  source: 'human' | 'scheduled';
  reason?: string;
  changes?: Array<{
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
  }>;
  createdAt: string;
}

export interface AuditLogFilters {
  eventType?: string | string[];
  entityType?: string | string[];
  entityId?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class AuditService {
  /**
   * Fetch audit logs with filters
   */
  static async getAuditLogs(filters?: AuditLogFilters) {
    const params: any = {};

    if (filters?.eventType) {
      // API expects comma-separated string for arrays in query
      const types = Array.isArray(filters.eventType)
        ? filters.eventType
        : [filters.eventType];
      params.eventType = types.join(',');
    }

    if (filters?.entityType) {
      const types = Array.isArray(filters.entityType)
        ? filters.entityType
        : [filters.entityType];
      params.entityType = types.join(',');
    }

    if (filters?.entityId) params.entityId = filters.entityId;
    if (filters?.actorId) params.actorId = filters.actorId;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;

    const response = await apiClient.get('/audit', { params });
    // Return full response to include pagination and data
    return response.data;
  }

  /**
   * Hook: Get audit logs with filters
   */
  static useAuditLogs(filters?: AuditLogFilters) {
    return useQuery({
      queryKey: filters
        ? (['audit', 'list', filters] as const)
        : (['audit', 'list'] as const),
      queryFn: () => AuditService.getAuditLogs(filters),
      staleTime: 30 * 1000, // 30 seconds - audit logs change frequently
    });
  }
}
