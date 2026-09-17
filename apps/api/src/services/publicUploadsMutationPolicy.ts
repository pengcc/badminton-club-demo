import { config } from '../config';
import { AppError } from '../utils/errors';

export function assertPublicUploadsMutationAllowed(
  alternateDevelopmentDatabase = config.alternateDevelopmentDatabase
): void {
  if (!alternateDevelopmentDatabase) return;

  throw new AppError(
    'Public upload changes are unavailable while an alternate development database is selected',
    503,
    'ALTERNATE_DEVELOPMENT_DATABASE_PUBLIC_UPLOADS_UNAVAILABLE'
  );
}
