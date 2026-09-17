import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountKind, Capability } from '@club/shared-types/core/enums';
import { User } from '../../models/User';
import { UserService } from '../../services/userService';
import EmailService from '../../services/emailService';
import { AuditService } from '../../services/auditService';
import { UserController } from '../../controllers/userController';

beforeEach(() => vi.restoreAllMocks());

describe('email-change confirmation contract', () => {
  it('uses the explicit workflow locale for the pending change and verification message', async () => {
    vi.spyOn(UserService, 'requestEmailChange').mockResolvedValue(
      'verification-token'
    );
    vi.spyOn(User, 'findById').mockResolvedValue({
      firstName: 'Test',
      lastName: 'Member',
    } as never);
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    await UserController.requestEmailChange(
      {
        body: { newEmail: 'new@example.test', locale: 'zh' },
        user: { id: 'user-id' },
        headers: { 'accept-language': 'en' },
      } as never,
      res as never
    );

    expect(UserService.requestEmailChange).toHaveBeenCalledWith(
      'user-id',
      'new@example.test',
      'zh'
    );
    expect(send).toHaveBeenCalledWith(
      'email_change_verification',
      'new@example.test',
      'zh',
      expect.objectContaining({
        verificationUrl: expect.stringContaining(
          '/zh/verify-email-change/verification-token'
        ),
        expiresIn: '1 小时',
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns the persisted old and new addresses after consuming the token', async () => {
    const user = {
      _id: { toString: () => 'user-id' },
      email: 'old@example.test',
      pendingEmail: 'new@example.test',
      pendingEmailLocale: 'en',
      emailChangeTokenDigest: 'digest',
      emailChangeExpire: new Date(Date.now() + 60_000),
      accountKind: AccountKind.PERSON,
    };
    vi.spyOn(User, 'findOne')
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue(user),
      } as never)
      .mockResolvedValueOnce(null);
    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue({
      ...user,
      email: 'new@example.test',
    } as never);

    await expect(
      UserService.verifyEmailChange('fake-email-change-token')
    ).resolves.toEqual({
      success: true,
      oldEmail: 'old@example.test',
      newEmail: 'new@example.test',
      userId: 'user-id',
      locale: 'en',
    });
    expect(User.findOneAndUpdate).toHaveBeenCalledOnce();
  });

  it('sends the confirmation to the new address with distinct old/new variables', async () => {
    vi.spyOn(UserService, 'verifyEmailChange').mockResolvedValue({
      success: true,
      oldEmail: 'old@example.test',
      newEmail: 'new@example.test',
      userId: 'user-id',
      locale: 'en',
    });
    vi.spyOn(User, 'findById').mockResolvedValue({
      firstName: 'Test',
      lastName: 'Member',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    } as never);
    const send = vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
    vi.spyOn(AuditService, 'writeBestEffort').mockReturnValue(undefined);
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    await UserController.verifyEmailChange(
      {
        params: { token: 'fake-email-change-token' },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-agent'),
      } as never,
      res as never
    );

    expect(send).toHaveBeenCalledWith(
      'email_change_confirmed',
      'new@example.test',
      'en',
      {
        name: 'Test Member',
        oldEmail: 'old@example.test',
        newEmail: 'new@example.test',
      }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('records Audit and reports the committed change when confirmation delivery fails', async () => {
    vi.spyOn(UserService, 'verifyEmailChange').mockResolvedValue({
      success: true,
      oldEmail: 'old@example.test',
      newEmail: 'new@example.test',
      userId: 'user-id',
      locale: 'zh',
    });
    vi.spyOn(User, 'findById').mockResolvedValue({
      firstName: 'Test',
      lastName: 'Member',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    } as never);
    vi.spyOn(EmailService, 'sendFromTemplate').mockRejectedValue(
      new Error('transport failed')
    );
    const audit = vi
      .spyOn(AuditService, 'writeBestEffort')
      .mockReturnValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);

    await UserController.verifyEmailChange(
      {
        params: { token: 'fake-email-change-token' },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-agent'),
      } as never,
      res as never
    );

    expect(audit).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
