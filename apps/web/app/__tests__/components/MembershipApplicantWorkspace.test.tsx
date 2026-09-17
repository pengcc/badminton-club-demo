import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicantMembershipApplicationResponse } from '@club/shared-types/api/membershipApplication';
import { renderWithIntl } from '../utils/renderWithIntl';
import MembershipApplicantWorkspace from '../../components/MembershipApplicantWorkspace';
import deCommon from '../../../messages/de/common.json';
import {
  getApplicantApplication,
  getApplicantSubmissionCorrectionFields,
  saveApplicantApplication,
  submitApplicantDraft,
  withdrawApplicantApplication,
  replaceApplicantStudentProof,
  emailApplicantDocuments,
  synchronizeApplicantCommunicationLocale,
} from '../../lib/api/membershipApplicationApi';

vi.mock('../../lib/api/membershipApplicationApi', () => ({
  getApplicantApplication: vi.fn(),
  getApplicantSubmissionCorrectionFields: vi.fn(),
  saveApplicantApplication: vi.fn(),
  submitApplicantDraft: vi.fn(),
  requestApplicantEmailChange: vi.fn(),
  withdrawApplicantApplication: vi.fn(),
  replaceApplicantStudentProof: vi.fn(),
  downloadApplicantDocument: vi.fn(),
  emailApplicantDocuments: vi.fn(),
  synchronizeApplicantCommunicationLocale: vi.fn(),
}));

const base: ApplicantMembershipApplicationResponse = {
  id: 'application-1',
  verifiedEmail: 'ada@example.test',
  communicationLocale: 'en',
  personalInfo: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    phone: '+49123456789',
    dateOfBirth: '1990-01-01',
    gender: 'female',
    address: {
      street: 'Test 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
    },
  },
  membershipType: 'regular',
  bankingSummary: { present: false, complete: false },
  status: 'draft',
  studentProof: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

async function selectSharedOption(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  await user.click(screen.getByRole('option', { name: option }));
}

describe('MembershipApplicantWorkspace', () => {
  beforeEach(() => {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.clearAllMocks();
    vi.mocked(getApplicantApplication).mockResolvedValue(base);
    vi.mocked(getApplicantSubmissionCorrectionFields).mockReturnValue(
      undefined
    );
    vi.mocked(saveApplicantApplication).mockImplementation(async (draft) => ({
      ...base,
      personalInfo: { ...base.personalInfo, ...draft.personalInfo },
    }));
    vi.mocked(submitApplicantDraft).mockResolvedValue({
      ...base,
      status: 'pending',
    });
    vi.mocked(withdrawApplicantApplication).mockResolvedValue();
    vi.mocked(replaceApplicantStudentProof).mockResolvedValue(base);
    vi.mocked(emailApplicantDocuments).mockResolvedValue();
    vi.mocked(synchronizeApplicantCommunicationLocale).mockResolvedValue();
  });

  it('changes communication language only after an explicit applicant selection', async () => {
    const navigate = vi.fn();
    renderWithIntl(<MembershipApplicantWorkspace navigate={navigate} />);

    const selector = await screen.findByLabelText(
      'Language for application messages'
    );
    expect(selector).toHaveTextContent('English');
    expect(synchronizeApplicantCommunicationLocale).not.toHaveBeenCalled();

    await selectSharedOption('Language for application messages', 'Chinese');

    await waitFor(() => {
      expect(synchronizeApplicantCommunicationLocale).toHaveBeenCalledWith(
        'zh'
      );
      expect(navigate).toHaveBeenCalledWith('/zh/apply/continue');
    });
  });

  it('maps a cleared shared Select choice back to the real empty draft value', async () => {
    renderWithIntl(<MembershipApplicantWorkspace />);

    await screen.findByLabelText('applicationForm.gender');
    await selectSharedOption(
      'applicationForm.gender',
      'applicationForm.genderOptions.male'
    );
    await selectSharedOption('applicationForm.gender', 'Select…');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(saveApplicantApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          personalInfo: expect.objectContaining({ gender: '' }),
        })
      )
    );
  });

  it('guards only unsaved edits and clears dirty state only after the server save succeeds', async () => {
    renderWithIntl(<MembershipApplicantWorkspace />);
    expect(
      await screen.findByText(/inactive drafts are deleted after 30 days/)
    ).toHaveTextContent(/deleted after 90 days/);
    const firstName = screen.getByLabelText('applicationForm.firstName');
    fireEvent.change(firstName, { target: { value: 'Augusta' } });

    const dirtyUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyUnload);
    expect(dirtyUnload.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'Saved on the server. You can safely continue later.'
      )
    ).toBeInTheDocument();
    expect(saveApplicantApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        personalInfo: expect.objectContaining({ firstName: 'Augusta' }),
      })
    );

    await waitFor(() => {
      const cleanUnload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(cleanUnload);
      expect(cleanUnload.defaultPrevented).toBe(false);
    });
  });

  it('submits complete core data without banking and exposes pending withdrawal behind confirmation', async () => {
    const view = renderWithIntl(<MembershipApplicantWorkspace />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Submit application' })
    );
    await waitFor(() => expect(submitApplicantDraft).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(
        'Application submitted for review. You may still correct it while pending.'
      )
    ).toBeInTheDocument();

    view.unmount();
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      status: 'pending',
    });
    renderWithIntl(<MembershipApplicantWorkspace />);
    expect(
      await screen.findByRole('heading', { name: 'Current documents' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download SEPA PDF' })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Email selected PDFs' })
    );
    await waitFor(() =>
      expect(emailApplicantDocuments).toHaveBeenCalledWith(['application'])
    );
    await screen.findByText(
      'Current documents were sent to the verified email.'
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add bank details now' })
    );
    expect(screen.getByLabelText('applicationForm.iban')).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Withdraw application' })
    );
    expect(screen.getByText('Confirm withdrawal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw' }));
    await waitFor(() =>
      expect(withdrawApplicantApplication).toHaveBeenCalledTimes(1)
    );
  });

  it('shows one required legend and counts only missing submission-required fields', async () => {
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      personalInfo: {
        ...base.personalInfo,
        firstName: undefined,
        address: {
          ...base.personalInfo.address!,
          street: undefined,
        },
      },
      membershipType: undefined,
    });
    renderWithIntl(<MembershipApplicantWorkspace />);

    const firstName = await screen.findByLabelText(/applicationForm.firstName/);
    expect(firstName).toBeRequired();
    expect(screen.getByLabelText(/applicationForm.phone/)).not.toBeRequired();
    expect(screen.getByLabelText('Motivation')).not.toBeRequired();
    expect(screen.getByLabelText(/applicationForm.gender/)).toHaveAttribute(
      'aria-required',
      'true'
    );
    expect(
      screen.getByRole('button', { name: 'Submit application' })
    ).toBeDisabled();
    const readiness = screen.getByRole('status');
    expect(readiness).toHaveTextContent('3 required fields remaining');
    expect(readiness).toHaveTextContent(
      /applicationForm.firstName.*applicationForm.address.*applicationForm.membershipType/
    );
    expect(screen.getAllByText('Required to submit')).toHaveLength(1);
    expect(firstName).toHaveAccessibleDescription(
      /3 required fields remaining.*applicationForm.firstName/
    );
  });

  it('updates the missing-required count as fields are completed', async () => {
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      personalInfo: {
        ...base.personalInfo,
        firstName: undefined,
        address: {
          ...base.personalInfo.address!,
          street: undefined,
        },
      },
    });
    renderWithIntl(<MembershipApplicantWorkspace />);

    await screen.findByText('2 required fields remaining');
    fireEvent.change(screen.getByLabelText(/applicationForm.firstName/), {
      target: { value: 'Ada' },
    });

    const readiness = screen.getByRole('status');
    expect(readiness).toHaveTextContent('1 required field remaining');
    expect(readiness).not.toHaveTextContent('applicationForm.firstName');
    expect(readiness).toHaveTextContent('applicationForm.address');
  });

  it('keeps omitted optional submission data non-blocking but rejects an invalid supplied phone', async () => {
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      personalInfo: { ...base.personalInfo, phone: undefined },
    });
    const view = renderWithIntl(<MembershipApplicantWorkspace />);
    expect(
      await screen.findByRole('button', { name: 'Submit application' })
    ).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/applicationForm.phone/), {
      target: { value: 'invalid' },
    });
    expect(
      screen.getByRole('button', { name: 'Submit application' })
    ).toBeDisabled();
    expect(screen.getByLabelText(/applicationForm.phone/)).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(
      screen.getByLabelText(/applicationForm.phone/)
    ).toHaveAccessibleDescription('Check this entry.');
    expect(
      screen.queryByText(/required fields? remaining/)
    ).not.toBeInTheDocument();
    view.unmount();
  });

  it('describes a present invalid required value locally instead of counting it as missing', async () => {
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      personalInfo: { ...base.personalInfo, dateOfBirth: '2099-01-01' },
    });
    renderWithIntl(<MembershipApplicantWorkspace />);

    const dateOfBirth = await screen.findByLabelText(
      /applicationForm.birthday/
    );
    expect(dateOfBirth).toHaveAttribute('aria-invalid', 'true');
    expect(dateOfBirth).toHaveAccessibleDescription('Check this entry.');
    expect(
      screen.queryByText(/required fields? remaining/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit application' })
    ).toBeDisabled();
  });

  it('maps the bounded backend validation contract to applicant correction guidance', async () => {
    vi.mocked(submitApplicantDraft).mockRejectedValue(new Error('rejected'));
    vi.mocked(getApplicantSubmissionCorrectionFields).mockReturnValue([
      'street',
    ]);
    renderWithIntl(<MembershipApplicantWorkspace />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Submit application' })
    );
    expect(
      await screen.findByText(
        'Submission needs correction. Review the highlighted fields.'
      )
    ).toBeInTheDocument();
    const street = screen.getByLabelText(/applicationForm.address/);
    expect(street).toHaveAttribute('aria-invalid', 'true');
    expect(street).toHaveAccessibleDescription('Check this entry.');
  });

  it('uses applicant versus another account holder wording and truthful banking timing', async () => {
    renderWithIntl(<MembershipApplicantWorkspace />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add bank details now' })
    );
    const accountHolder = screen.getByLabelText(
      'applicationForm.accountHolderSelection'
    );
    const bankName = screen.getByLabelText('applicationForm.bankName');
    const bic = screen.getByLabelText('applicationForm.bic');
    const iban = screen.getByLabelText('applicationForm.iban');
    const frequency = screen.getByLabelText('Debit frequency');
    for (const control of [accountHolder, bankName, bic, iban, frequency]) {
      expect(control).not.toHaveAttribute('aria-required');
    }
    const banking = screen.getByRole('group', { name: 'Bank details' });
    expect(banking).toHaveAccessibleDescription(
      /Complete bank details are required before approval/
    );
    expect(bankName).not.toHaveAccessibleDescription();
    expect(iban).not.toHaveAccessibleDescription();
    expect(frequency).not.toHaveAccessibleDescription();
    expect(bic).toHaveAccessibleDescription('(Optional)');
    await selectSharedOption(
      'applicationForm.accountHolderSelection',
      'Another account holder'
    );
    const otherAccountHolderFields = [
      screen.getByLabelText(/applicationForm.accountHolderFirstName/),
      screen.getByLabelText(/applicationForm.accountHolderLastName/),
      screen.getByLabelText(/applicationForm.accountHolderAddress/),
    ];
    for (const field of otherAccountHolderFields) {
      expect(field).not.toHaveAttribute('aria-required');
      expect(field).not.toHaveAccessibleDescription();
    }
    expect(screen.queryByText('Different payer')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Complete bank details are required before approval/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Required before approval/)
    ).not.toBeInTheDocument();
    expect(screen.getByText('(Optional)')).toBeInTheDocument();
  });

  it('guides student proof upload and saves only through the private proof API', async () => {
    const student = { ...base, membershipType: 'student' as const };
    vi.mocked(getApplicantApplication).mockResolvedValue(student);
    vi.mocked(replaceApplicantStudentProof).mockResolvedValue({
      ...student,
      studentProof: [
        {
          id: 'private-proof.pdf',
          originalName: 'proof.pdf',
          mimeType: 'application/pdf',
          size: 10,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });
    const view = renderWithIntl(<MembershipApplicantWorkspace />);
    expect(
      await screen.findByText(/HEIC is not supported/)
    ).toBeInTheDocument();
    const input = view.container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'proof.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save proof files' }));
    await waitFor(() =>
      expect(replaceApplicantStudentProof).toHaveBeenCalledWith([], [file])
    );
    expect(
      await screen.findByText('Student proof files were saved privately.')
    ).toBeInTheDocument();
  });

  it('guards unsaved proof changes and continue editing preserves every local change', async () => {
    const student = { ...base, membershipType: 'student' as const };
    vi.mocked(getApplicantApplication).mockResolvedValue(student);
    const navigate = vi.fn();
    const view = renderWithIntl(
      <>
        <MembershipApplicantWorkspace navigate={navigate} />
        <a href="/en">Home</a>
      </>
    );
    const firstName = await screen.findByLabelText('applicationForm.firstName');
    fireEvent.change(firstName, { target: { value: 'Augusta' } });
    const input = view.container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'proof.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(
      await screen.findByText('Leave with unsaved changes?')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue editing' }));

    expect(firstName).toHaveValue('Augusta');
    expect(input.files).toEqual([file]);
    expect(navigate).not.toHaveBeenCalled();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('saves both dirty boundaries before leaving and bypasses the native guard once', async () => {
    const student = { ...base, membershipType: 'student' as const };
    vi.mocked(getApplicantApplication).mockResolvedValue(student);
    vi.mocked(saveApplicantApplication).mockImplementation(async (draft) => ({
      ...student,
      personalInfo: { ...student.personalInfo, ...draft.personalInfo },
    }));
    vi.mocked(replaceApplicantStudentProof).mockResolvedValue({
      ...student,
      personalInfo: { ...student.personalInfo, firstName: 'Augusta' },
      studentProof: [
        {
          id: 'proof.pdf',
          originalName: 'proof.pdf',
          mimeType: 'application/pdf',
          size: 10,
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });
    const navigate = vi.fn();
    const view = renderWithIntl(
      <>
        <MembershipApplicantWorkspace navigate={navigate} />
        <a href="/next-step">Next page</a>
      </>
    );
    fireEvent.change(
      await screen.findByLabelText('applicationForm.firstName'),
      {
        target: { value: 'Augusta' },
      }
    );
    const file = new File(['%PDF-1.4'], 'proof.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Next page' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save draft and leave' })
    );

    await waitFor(() =>
      expect(saveApplicantApplication).toHaveBeenCalledOnce()
    );
    expect(replaceApplicantStudentProof).toHaveBeenCalledWith([], [file]);
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.stringMatching(/\/next-step$/)
      )
    );
    const bypassedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(bypassedUnload);
    expect(bypassedUnload.defaultPrevented).toBe(false);
  });

  it('saves proof removal before switching from student to regular and leaving', async () => {
    const proof = {
      id: 'proof.pdf',
      originalName: 'proof.pdf',
      mimeType: 'application/pdf' as const,
      size: 10,
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    const student = {
      ...base,
      membershipType: 'student' as const,
      studentProof: [proof],
    };
    vi.mocked(getApplicantApplication).mockResolvedValue(student);
    let proofSaved = false;
    vi.mocked(replaceApplicantStudentProof).mockImplementation(
      async (retainedIds) => {
        expect(retainedIds).toEqual([]);
        proofSaved = true;
        return { ...student, studentProof: [] };
      }
    );
    vi.mocked(saveApplicantApplication).mockImplementation(async (draft) => {
      expect(proofSaved).toBe(true);
      return {
        ...student,
        membershipType: draft.membershipType,
        studentProof: [],
      };
    });
    const navigate = vi.fn();
    renderWithIntl(
      <>
        <MembershipApplicantWorkspace navigate={navigate} />
        <a href="/next-step">Next page</a>
      </>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await selectSharedOption(
      'applicationForm.membershipType',
      'applicationForm.membershipTypes.regular'
    );
    fireEvent.click(screen.getByRole('link', { name: 'Next page' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save draft and leave' })
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.stringMatching(/\/next-step$/)
      )
    );
    expect(replaceApplicantStudentProof).toHaveBeenCalledWith([], []);
    expect(saveApplicantApplication).toHaveBeenCalledWith(
      expect.objectContaining({ membershipType: 'regular' })
    );
  });

  it('keeps only application data dirty when proof-first save succeeds and data save fails', async () => {
    const proof = {
      id: 'proof.pdf',
      originalName: 'proof.pdf',
      mimeType: 'application/pdf' as const,
      size: 10,
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    const student = {
      ...base,
      membershipType: 'student' as const,
      studentProof: [proof],
    };
    vi.mocked(getApplicantApplication).mockResolvedValue(student);
    vi.mocked(replaceApplicantStudentProof).mockResolvedValue({
      ...student,
      studentProof: [],
    });
    vi.mocked(saveApplicantApplication).mockRejectedValue(
      new Error('save failed')
    );
    const navigate = vi.fn();
    renderWithIntl(
      <>
        <MembershipApplicantWorkspace navigate={navigate} />
        <a href="/next-step">Next page</a>
      </>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await selectSharedOption(
      'applicationForm.membershipType',
      'applicationForm.membershipTypes.regular'
    );
    fireEvent.click(screen.getByRole('link', { name: 'Next page' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save draft and leave' })
    );

    expect(
      await screen.findByText(
        'Proof changes were saved, but application details are still unsaved. You are still on this page.'
      )
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('leaves without saving once without suppressing later native warnings', async () => {
    const navigate = vi.fn();
    renderWithIntl(
      <>
        <MembershipApplicantWorkspace navigate={navigate} />
        <a href="/next-step">Next page</a>
      </>
    );
    fireEvent.change(
      await screen.findByLabelText('applicationForm.firstName'),
      {
        target: { value: 'Augusta' },
      }
    );
    fireEvent.click(screen.getByRole('link', { name: 'Next page' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Leave without saving' })
    );
    expect(navigate).toHaveBeenCalledWith(
      expect.stringMatching(/\/next-step$/)
    );
    expect(saveApplicantApplication).not.toHaveBeenCalled();

    const bypassedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(bypassedUnload);
    expect(bypassedUnload.defaultPrevented).toBe(false);
    const laterUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(laterUnload);
    expect(laterUnload.defaultPrevented).toBe(true);
  });

  it('advances only the saved data baseline when proof save fails before leaving', async () => {
    const student = { ...base, membershipType: 'student' as const };
    vi.mocked(getApplicantApplication).mockResolvedValue(student);
    vi.mocked(saveApplicantApplication).mockImplementation(async (draft) => ({
      ...student,
      personalInfo: { ...student.personalInfo, ...draft.personalInfo },
    }));
    vi.mocked(replaceApplicantStudentProof).mockRejectedValue(
      new Error('upload failed')
    );
    const navigate = vi.fn();
    const view = renderWithIntl(
      <>
        <MembershipApplicantWorkspace navigate={navigate} />
        <a href="/next-step">Next page</a>
      </>
    );
    fireEvent.change(
      await screen.findByLabelText('applicationForm.firstName'),
      {
        target: { value: 'Augusta' },
      }
    );
    const file = new File(['%PDF-1.4'], 'proof.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Next page' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save draft and leave' })
    );

    expect(
      await screen.findByText(
        'Application details were saved, but proof changes are still unsaved. You are still on this page.'
      )
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('renders localized German proof guidance and status labels from the real catalog', async () => {
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      membershipType: 'student',
    });
    renderWithIntl(<MembershipApplicantWorkspace />, {
      locale: 'de',
      messages: { common: deCommon },
    });
    expect(
      await screen.findByRole('heading', { name: /^Studierendennachweis/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/HEIC wird nicht unterstützt/)).toBeInTheDocument();
    expect(screen.getByText('Status: Entwurf')).toBeInTheDocument();
    expect(screen.getByText('Deutschland')).toBeInTheDocument();
    expect(screen.getAllByText('Zum Absenden erforderlich')).toHaveLength(1);
    expect(
      screen.getByText(
        /Vollständige Bankdaten sind vor der Genehmigung erforderlich/
      )
    ).toBeInTheDocument();
  });

  it('warns when saved changes reset a signed-document receipt', async () => {
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      status: 'pending',
      signedApplicationReceipt: {
        receivedAt: '2026-08-01T00:00:00.000Z',
        resetAt: '2026-08-02T00:00:00.000Z',
        resetReason: 'applicant_application_data_changed',
      },
    });
    renderWithIntl(<MembershipApplicantWorkspace />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalidated a previously received signed document/
    );
  });

  it('can explicitly remove saved banking details through the canonical save path', async () => {
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      status: 'pending',
      bankingSummary: { present: true, complete: true, ibanLastFour: '2051' },
      bankingInfo: {
        accountHolderType: 'same',
        bankName: 'Bank',
        iban: 'DE02120300000000202051',
        bic: 'BYLADEM1001',
        debitFrequency: 'quarterly',
      },
    });
    renderWithIntl(<MembershipApplicantWorkspace />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove saved bank details' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(saveApplicantApplication).toHaveBeenCalledWith(
        expect.objectContaining({ bankingInfo: null })
      )
    );
  });

  it.each([
    'approved',
    'rejected',
  ] as const)('renders %s applications read-only', async (status) => {
    vi.mocked(getApplicantApplication).mockResolvedValue({
      ...base,
      status,
      ...(status === 'rejected'
        ? { rejectionReason: 'Capacity' }
        : { approvalMessage: 'Welcome to the club' }),
    });
    renderWithIntl(<MembershipApplicantWorkspace />);
    expect(
      await screen.findByLabelText('applicationForm.firstName')
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Withdraw application' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        status === 'rejected' ? /Capacity/ : /Welcome to the club/
      )
    ).toBeInTheDocument();
  });
});
