import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberCsvPreview } from '@club/shared-types/api/memberCsv';
import messages from '../../../messages/en/dashboard.json';
import MemberCsvImportModal from '../../components/Dashboard/modals/MemberCsvImportModal';
import * as api from '../../lib/api/userApi';
vi.mock('../../lib/api/userApi', () => ({
  previewMemberCsv: vi.fn(),
  applyMemberCsv: vi.fn(),
}));
const preview: MemberCsvPreview = {
  previewContext: 'first-preview',
  rows: [
    {
      rowNumber: 2,
      name: 'Synthetic Member',
      email: 'member@example.test',
      outcome: 'create',
      changes: [],
    },
  ],
  counts: {
    create: 1,
    update: 0,
    unchanged: 0,
    review_required: 0,
    conflict: 0,
    invalid: 0,
  },
};
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={{ dashboard: messages }}>
        <MemberCsvImportModal onClose={onClose} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { user: userEvent.setup(), invalidate, onClose };
}
async function upload(
  user: ReturnType<typeof userEvent.setup>,
  name = 'members.csv'
) {
  await user.upload(
    screen.getByLabelText('Member CSV file'),
    new File(['synthetic'], name, { type: 'text/csv' })
  );
}
beforeEach(() => {
  vi.mocked(api.previewMemberCsv).mockResolvedValue(preview);
  vi.mocked(api.applyMemberCsv).mockResolvedValue({
    ...preview,
    status: 'completed',
    auditSummary: 'written',
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe('Member CSV modal', () => {
  it('requires preview then deliberate apply, invalidating business queries only after apply', async () => {
    const { user, invalidate } = setup();
    expect(
      screen.queryByRole('button', { name: 'Apply 1 changes' })
    ).not.toBeInTheDocument();
    await upload(user);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      await screen.findByText('Preview only — no changes applied.')
    ).toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apply 1 changes' }));
    expect(await screen.findByText('Import completed.')).toBeInTheDocument();
    expect(api.applyMemberCsv).toHaveBeenCalledWith(
      expect.any(File),
      'first-preview'
    );
    expect(invalidate).toHaveBeenCalledTimes(3);
  });
  it('file replacement invalidates preview and apply authority', async () => {
    const { user } = setup();
    await upload(user);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByRole('button', { name: 'Apply 1 changes' });
    await upload(user, 'replacement.csv');
    expect(
      screen.queryByRole('button', { name: 'Apply 1 changes' })
    ).not.toBeInTheDocument();
    expect(api.applyMemberCsv).not.toHaveBeenCalled();
  });
  it.each([
    'incomplete',
    'network',
  ])('discards apply authority after %s and recovers through a fresh preview', async (failure) => {
    if (failure === 'incomplete')
      vi.mocked(api.applyMemberCsv).mockResolvedValueOnce({
        ...preview,
        status: 'incomplete',
        auditSummary: 'not_attempted',
      });
    else
      vi.mocked(api.applyMemberCsv).mockRejectedValueOnce(
        new Error('never display raw')
      );
    const { user } = setup();
    await upload(user);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await user.click(
      await screen.findByRole('button', { name: 'Apply 1 changes' })
    );
    await screen.findByText(/Apply incomplete/);
    expect(
      screen.queryByRole('button', { name: /Apply 1/ })
    ).not.toBeInTheDocument();
    expect(api.applyMemberCsv).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('never display raw')).not.toBeInTheDocument();
    vi.mocked(api.previewMemberCsv).mockResolvedValueOnce({
      ...preview,
      previewContext: 'fresh-preview',
    });
    await user.click(screen.getByRole('button', { name: 'Preview again' }));
    await user.click(
      await screen.findByRole('button', { name: 'Apply 1 changes' })
    );
    expect(await screen.findByText('Import completed.')).toBeInTheDocument();
    expect(
      vi.mocked(api.applyMemberCsv).mock.calls.map((call) => call[1])
    ).toEqual(['first-preview', 'fresh-preview']);
  });
  it('shows a supplemental audit warning without losing completed business status', async () => {
    vi.mocked(api.applyMemberCsv).mockResolvedValueOnce({
      ...preview,
      status: 'completed',
      auditSummary: 'failed',
    });
    const { user } = setup();
    await upload(user);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await user.click(
      await screen.findByRole('button', { name: 'Apply 1 changes' })
    );
    expect(await screen.findByText('Import completed.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Changes were saved');
    expect(
      screen.queryByRole('button', { name: /Apply 1/ })
    ).not.toBeInTheDocument();
  });
  it('presents partial results and refreshes business queries', async () => {
    vi.mocked(api.applyMemberCsv).mockResolvedValueOnce({
      ...preview,
      status: 'partial',
      auditSummary: 'written',
    });
    const { user, invalidate } = setup();
    await upload(user);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await user.click(
      await screen.findByRole('button', { name: 'Apply 1 changes' })
    );
    expect(
      await screen.findByText('Import completed with rows held for review.')
    ).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledTimes(3);
  });
  it('new failed preview discards old previewContext and shows bounded errors', async () => {
    const { user } = setup();
    await upload(user);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByRole('button', { name: 'Apply 1 changes' });
    vi.mocked(api.previewMemberCsv).mockRejectedValueOnce(
      new Error('raw sensitive')
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByRole('alert');
    expect(
      screen.queryByRole('button', { name: 'Apply 1 changes' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('raw sensitive')).not.toBeInTheDocument();
  });
  it('shows blocked/stale reasons and keyboard close', async () => {
    vi.mocked(api.previewMemberCsv).mockResolvedValueOnce({
      ...preview,
      counts: { ...preview.counts, create: 0, review_required: 1 },
      rows: [
        { ...preview.rows[0], outcome: 'review_required', reason: 'stale' },
      ],
    });
    const { user, onClose } = setup();
    await upload(user);
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      await screen.findByText(
        'Relevant data changed after preview. Preview again.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Apply 0 changes' })
    ).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
