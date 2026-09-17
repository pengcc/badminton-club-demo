import axios from 'axios';
import { SESSION_INVALID_ERROR_CODE } from '@club/shared-types/core/authSession';
import { reloadCurrentDocument } from '@app/lib/navigation/documentNavigation';

// Client-side: use relative /api path — Next.js rewrites proxy to backend
const API_BASE_URL = '/api';

/**
 * Axios instance for the same-origin API boundary.
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function isSessionInvalidError(error: unknown): boolean {
  return Boolean(
    axios.isAxiosError(error) &&
      error.response?.data?.code === SESSION_INVALID_ERROR_CODE
  );
}

function isSessionVerificationRequest(error: unknown): boolean {
  return Boolean(
    axios.isAxiosError(error) &&
      error.config?.url?.split('?')[0] === '/auth/verify'
  );
}

/**
 * Response interceptor - Handle auth errors globally
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isSessionInvalidError(error) && !isSessionVerificationRequest(error)) {
      if (typeof window !== 'undefined') {
        reloadCurrentDocument();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
