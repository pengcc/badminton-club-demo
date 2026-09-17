import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Api } from '../api/team';
import { TeamLevel } from '../core/enums';
import {
  createTeamSchema,
  type CreateTeamInput,
  updateTeamSchema,
  type UpdateTeamInput,
} from '../schemas/team';
import { TeamViewTransformers } from '../view/transformers/team';

const formData = {
  teamId: 't1',
  shortName: 'DCBV I',
  leagueTeamName: 'DCBV I',
  matchLevel: TeamLevel.A,
};

describe('Team mutation contract', () => {
  it('uses the schema-inferred inputs as the API request types', () => {
    expectTypeOf<Api.CreateTeamRequest>().toEqualTypeOf<CreateTeamInput>();
    expectTypeOf<Api.UpdateTeamRequest>().toEqualTypeOf<UpdateTeamInput>();
  });

  it('strips actor and roster fields from caller-owned payloads', () => {
    expect(
      createTeamSchema.parse({
        ...formData,
        createdById: '507f1f77bcf86cd799439011',
        updatedById: '507f1f77bcf86cd799439012',
        playerIds: ['507f1f77bcf86cd799439013'],
      })
    ).toEqual(formData);

    expect(
      updateTeamSchema.parse({
        shortName: 'DCBV II',
        createdById: '507f1f77bcf86cd799439011',
        updatedById: '507f1f77bcf86cd799439012',
        playerIds: ['507f1f77bcf86cd799439013'],
      })
    ).toEqual({ shortName: 'DCBV II' });
  });

  it('creates Web requests without fabricated actor fields', () => {
    expect(TeamViewTransformers.toCreateRequest(formData)).toEqual(formData);
    expect(
      TeamViewTransformers.toUpdateRequest({
        shortName: formData.shortName,
        matchLevel: formData.matchLevel,
      })
    ).toEqual({
      shortName: formData.shortName,
      leagueTeamName: undefined,
      matchLevel: formData.matchLevel,
    });
  });
});
