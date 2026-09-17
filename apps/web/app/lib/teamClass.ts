import { TeamLevel } from '@club/shared-types/core/enums';

export const teamClassOptions = Object.values(TeamLevel);

export function formatTeamClass(level: TeamLevel): string {
  return `${level}-Klasse`;
}
