import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import dashboard from '../../../messages/en/dashboard.json';
import { MemberStatistics } from '../../components/Dashboard/MemberStatistics';

describe('MemberStatistics', () => {
  const statistics = {
    total: 8,
    gender: { male: 2, female: 3, other: 1, missing: 2 },
    birthYears: [
      { year: 1992, male: 0, female: 2, other: 1, missing: 1 },
      { year: 1993, male: 2, female: 1, other: 0, missing: 0 },
    ],
    missingBirthDate: 1,
  };

  function renderStatistics(overrides: Partial<typeof statistics> = {}) {
    return render(
      <NextIntlClientProvider locale="en" messages={{ dashboard }}>
        <MemberStatistics
          cohortLabel="Selected active participants"
          statistics={{ ...statistics, ...overrides }}
        />
      </NextIntlClientProvider>
    );
  }

  it('preserves the selected-cohort total and expand/collapse behavior', async () => {
    const user = userEvent.setup();
    renderStatistics();
    const trigger = screen.getByRole('button', {
      name: 'Selected active participants: 8 people',
    });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('heading', { name: 'Birth year distribution' })
    ).not.toBeInTheDocument();

    await user.tab();

    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('heading', { name: 'Birth year distribution' })
    ).toBeVisible();

    await user.keyboard(' ');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders exact years in source order with accessible primary values', async () => {
    const user = userEvent.setup();
    renderStatistics();

    await user.click(
      screen.getByRole('button', {
        name: 'Selected active participants: 8 people',
      })
    );

    const [firstYear, secondYear] = screen.getAllByRole('listitem');

    expect(within(firstYear).getByText('1992: 4 people')).toBeInTheDocument();
    expect(within(firstYear).getByText('Male:')).toBeInTheDocument();
    expect(within(firstYear).getByText('Female:')).toBeInTheDocument();
    expect(firstYear).toHaveTextContent(/Male:\s*0/);
    expect(firstYear).toHaveTextContent(/Female:\s*2/);
    expect(within(firstYear).getByText('Non-binary: 1')).toBeVisible();
    expect(within(firstYear).getByText('Gender not provided: 1')).toBeVisible();
    expect(within(secondYear).getByText('1993: 3 people')).toBeInTheDocument();
  });

  it('separates the three gender categories from missing-gender coverage', async () => {
    const user = userEvent.setup();
    renderStatistics();

    await user.click(
      screen.getByRole('button', {
        name: 'Selected active participants: 8 people',
      })
    );

    const summary = screen
      .getByRole('heading', { name: 'Gender distribution' })
      .closest('section');

    expect(summary).not.toBeNull();
    for (const [label, value] of [
      ['Male', '2'],
      ['Female', '3'],
      ['Non-binary', '1'],
    ]) {
      const term = within(summary!).getByText(label, { selector: 'dt' });

      expect(term).toHaveRole('term');
      expect(term.nextElementSibling).toHaveRole('definition');
      expect(term.nextElementSibling).toHaveTextContent(value);
    }
    expect(within(summary!).getAllByRole('term')).toHaveLength(3);
    expect(within(summary!).getByText('Gender not provided: 2')).toBeVisible();
    expect(
      within(summary!).queryByText('Gender not provided: 2', {
        selector: 'dt',
      })
    ).not.toBeInTheDocument();
  });

  it('omits missing-gender coverage when its count is zero', async () => {
    const user = userEvent.setup();
    renderStatistics({
      gender: { ...statistics.gender, missing: 0 },
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Selected active participants: 8 people',
      })
    );

    const summary = screen
      .getByRole('heading', { name: 'Gender distribution' })
      .closest('section');

    expect(summary).not.toBeNull();
    expect(
      within(summary!).queryByText(/Gender not provided:/)
    ).not.toBeInTheDocument();
  });

  it('omits zero-value secondary detail without hiding primary zero values', async () => {
    const user = userEvent.setup();
    renderStatistics();

    await user.click(
      screen.getByRole('button', {
        name: 'Selected active participants: 8 people',
      })
    );

    const secondYear = screen.getAllByRole('listitem')[1];

    expect(within(secondYear).getByText('Male:')).toBeInTheDocument();
    expect(within(secondYear).getByText('Female:')).toBeInTheDocument();
    expect(secondYear).toHaveTextContent(/Male:\s*2/);
    expect(secondYear).toHaveTextContent(/Female:\s*1/);
    expect(
      within(secondYear).queryByText(/^Non-binary:/)
    ).not.toBeInTheDocument();
    expect(
      within(secondYear).queryByText(/^Gender not provided:/)
    ).not.toBeInTheDocument();
  });

  it('places non-zero missing birth-date coverage before the year rows', async () => {
    const user = userEvent.setup();
    renderStatistics();

    await user.click(
      screen.getByRole('button', {
        name: 'Selected active participants: 8 people',
      })
    );

    const warning = screen.getByText('Missing birth date: 1');
    const firstYear = screen.getAllByRole('listitem')[0];

    expect(warning).toBeVisible();
    expect(
      warning.compareDocumentPosition(firstYear) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('does not add missing birth-date warning noise for a zero count', async () => {
    const user = userEvent.setup();
    renderStatistics({ missingBirthDate: 0 });

    await user.click(
      screen.getByRole('button', {
        name: 'Selected active participants: 8 people',
      })
    );

    expect(screen.queryByText(/Missing birth date:/)).not.toBeInTheDocument();
  });
});
