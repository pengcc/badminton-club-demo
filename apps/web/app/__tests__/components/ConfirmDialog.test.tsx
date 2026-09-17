import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';

function Harness({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const { confirm, confirmProps } = useConfirmDialog({
    confirmText: '删除',
    cancelText: '取消',
    pendingText: '正在处理…',
  });

  return (
    <>
      <button
        type="button"
        onClick={() =>
          confirm({
            title: '确认删除？',
            description: '此操作无法撤销。',
            onConfirm,
          })
        }
      >
        请求删除
      </button>
      <ConfirmDialog {...confirmProps} />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('uses caller-owned localized labels while the action is pending', async () => {
    let finish: (() => void) | undefined;
    const onConfirm = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve))
    );

    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: '请求删除' }));
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(
      await screen.findByRole('button', { name: '正在处理…' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeVisible();

    await act(async () => finish?.());
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
  });
});
