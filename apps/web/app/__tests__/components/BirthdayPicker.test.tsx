import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import common from '../../../messages/en/common.json';
import { BirthdayPicker } from '../../components/ui/BirthdayPicker';

function BirthdayHarness() {
  const [value, setValue] = useState('');
  return (
    <NextIntlClientProvider locale="en" messages={{ common }}>
      <BirthdayPicker label="Date of Birth" value={value} onChange={setValue} />
      <output aria-label="Selected birthday">{value}</output>
    </NextIntlClientProvider>
  );
}

describe('BirthdayPicker modal-local controls', () => {
  it('selects a valid leap-day value through native Month and Day controls', async () => {
    const user = userEvent.setup();
    render(<BirthdayHarness />);

    await user.click(screen.getByLabelText('Date of Birth'));
    await user.click(screen.getByRole('button', { name: '2000' }));
    await user.selectOptions(screen.getByLabelText('Month'), '02');
    await user.selectOptions(screen.getByLabelText('Day'), '29');

    expect(screen.getByLabelText('Selected birthday')).toHaveTextContent(
      '2000-02-29'
    );
    expect(screen.getByLabelText('Month').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Day').tagName).toBe('SELECT');
  });

  it('adjusts an invalid day when the selected month becomes shorter', async () => {
    const user = userEvent.setup();
    render(<BirthdayHarness />);

    await user.click(screen.getByLabelText('Date of Birth'));
    await user.click(screen.getByRole('button', { name: '2001' }));
    await user.selectOptions(screen.getByLabelText('Month'), '01');
    await user.selectOptions(screen.getByLabelText('Day'), '31');
    await user.selectOptions(screen.getByLabelText('Month'), '02');

    expect(screen.getByLabelText('Selected birthday')).toHaveTextContent(
      '2001-02-28'
    );
  });
});
