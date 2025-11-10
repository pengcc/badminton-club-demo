import apiClient from './client';
import { ApiResponse } from './types';

/**
 * Content Management API module
 * Handles CMS content operations
 */

/**
 * Query parameters for content retrieval
 */
export interface ContentQueryParams {
  keys?: string[];
  language?: string;
}

/**
 * Content item type
 */
export interface ContentItem {
  key: string;
  value: string;
  language: string;
  [key: string]: any;
}

/**
 * Get content items
 */
export const getContent = async (
  keys?: string[],
  language?: string
): Promise<ContentItem[]> => {
  const params: Record<string, any> = {};
  if (keys) params.keys = keys.join(',');
  if (language) params.language = language;

  const response = await apiClient.get<ApiResponse<ContentItem[]>>('/content', { params });
  return response.data.data;
};

/**
 * Update content item
 */
export const updateContent = async (contentData: Partial<ContentItem>): Promise<ContentItem> => {
  const response = await apiClient.post<ApiResponse<ContentItem>>('/content', contentData);
  return response.data.data;
};
