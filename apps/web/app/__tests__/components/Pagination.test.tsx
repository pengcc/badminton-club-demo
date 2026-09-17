import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Pagination } from '../../components/ui/Pagination';

const messages = {
  common: {
    pagination: {
      range: 'Showing {start} to {end} of {total} items',
      rangeCompact: '{start}–{end} / {total}',
      perPage: 'Items per page:',
      perPageCompact: 'Per page',
      perPageLabel: 'Items per page',
      page: 'Page {current} of {total}',
      pageCompact: '{current} / {total}',
      previous: 'Previous page',
      next: 'Next page',
    },
  },
};

function renderPagination(
  overrides: Partial<React.ComponentProps<typeof Pagination>> = {}
) {
  const props: React.ComponentProps<typeof Pagination> = {
    currentPage: 2,
    totalItems: 45,
    pageSize: 20,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    ...overrides,
  };

  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Pagination {...props} />
    </NextIntlClientProvider>
  );

  return { ...view, props };
}

describe('Pagination', () => {
  beforeEach(() => {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
  });

  it('retains range and current-page context and navigates between pages', async () => {
    const user = userEvent.setup();
    const { props } = renderPagination();

    expect(
      screen.getByText('Showing 21 to 40 of 45 items')
    ).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(props.onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(props.onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('disables navigation at the first and last page boundaries', () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Pagination
          currentPage={1}
          totalItems={45}
          pageSize={20}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByRole('button', { name: 'Previous page' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Pagination
          currentPage={3}
          totalItems={45}
          pageSize={20}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('labels and updates the page-size control', async () => {
    const user = userEvent.setup();
    const { props } = renderPagination();
    const pageSizeSelect = screen.getByRole('combobox', {
      name: 'Items per page',
    });

    await user.click(pageSizeSelect);
    await user.click(screen.getByRole('option', { name: '50' }));

    expect(props.onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('renders nothing when there are no items', () => {
    const { container } = renderPagination({ totalItems: 0 });

    expect(container).toBeEmptyDOMElement();
  });
});
