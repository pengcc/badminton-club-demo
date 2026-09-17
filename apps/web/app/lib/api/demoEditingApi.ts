import apiClient from './client';
import type { DemoEditingStatus } from '@club/shared-types/api/demoEditing';
import type { ApiResponse } from './types';

export async function getDemoEditingStatus(): Promise<DemoEditingStatus> {
  const response = await apiClient.get<ApiResponse<DemoEditingStatus>>(
    '/demo-editing/status'
  );
  return response.data.data;
}

export async function startDemoEditing(): Promise<DemoEditingStatus> {
  const response = await apiClient.post<ApiResponse<DemoEditingStatus>>(
    '/demo-editing/start'
  );
  return response.data.data;
}

export async function finishDemoEditing(): Promise<DemoEditingStatus> {
  const response = await apiClient.post<ApiResponse<DemoEditingStatus>>(
    '/demo-editing/finish'
  );
  return response.data.data;
}
