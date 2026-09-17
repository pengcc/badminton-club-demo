import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import zhCommon from '../../../messages/zh/common.json';
import { renderWithIntl } from '../utils/renderWithIntl';
import MembershipApplicantAccessConsumer from '../../components/MembershipApplicantAccessConsumer';
import { consumeApplicantAccess } from '../../lib/api/membershipApplicationApi';

vi.mock('../../lib/api/membershipApplicationApi', () => ({
  consumeApplicantAccess: vi.fn(),
  getApplicantApplication: vi.fn(),
}));

describe('MembershipApplicantAccessConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      null,
      '',
      '/zh/apply/continue#token=single-use-token'
    );
  });

  it('renders localized Chinese loading and access-failure content from the real catalog', async () => {
    let rejectAccess!: (error: Error) => void;
    vi.mocked(consumeApplicantAccess).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectAccess = reject;
        })
    );
    renderWithIntl(<MembershipApplicantAccessConsumer />, {
      locale: 'zh',
      messages: { common: zhCommon },
    });

    expect(screen.getByRole('status')).toHaveTextContent('正在打开您的申请…');
    rejectAccess(new Error('expired'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '此一次性链接无效或已过期，请从会员页面重新申请链接。'
    );
  });
});
