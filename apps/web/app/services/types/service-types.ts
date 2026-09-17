/**
 * Filter options for team queries
 */
export interface TeamFilters {
  search?: string;
  status?: 'active' | 'inactive';
}

/**
 * Filter options for match queries
 */
export interface MatchFilters {
  teamId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Batch update request structure
 */
export interface BatchUpdateRequest<T> {
  ids: string[];
  updateData: T;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Sort options
 */
export interface SortOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Combined query options
 */
export type QueryOptions = PaginationOptions & SortOptions;
