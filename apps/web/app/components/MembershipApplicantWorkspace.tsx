'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  ApplicantMembershipApplicationResponse,
  SaveMembershipApplicationRequest,
} from '@club/shared-types/api/membershipApplication';
import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import {
  getMembershipApplicationSubmissionReadiness,
  type MembershipApplicationSubmissionCorrectionField,
} from '@club/shared-types/domain/membershipApplication';
import {
  getApplicantApplication,
  getApplicantSubmissionCorrectionFields,
  downloadApplicantDocument,
  emailApplicantDocuments,
  replaceApplicantStudentProof,
  requestApplicantEmailChange,
  saveApplicantApplication,
  submitApplicantDraft,
  synchronizeApplicantCommunicationLocale,
  withdrawApplicantApplication,
} from '@app/lib/api/membershipApplicationApi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

type Draft = SaveMembershipApplicationRequest;

const CLEAR_APPLICANT_SELECT_VALUE = '__clear-applicant-select__';

const SUBMISSION_REQUIRED_FIELDS =
  new Set<MembershipApplicationSubmissionCorrectionField>([
    'firstName',
    'lastName',
    'dateOfBirth',
    'gender',
    'street',
    'city',
    'postalCode',
    'membershipType',
  ]);

function getDraftFieldValue(
  draft: Draft | undefined,
  field: MembershipApplicationSubmissionCorrectionField
): unknown {
  switch (field) {
    case 'firstName':
    case 'lastName':
    case 'phone':
    case 'dateOfBirth':
    case 'gender':
      return draft?.personalInfo?.[field];
    case 'street':
    case 'city':
    case 'postalCode':
      return draft?.personalInfo?.address?.[field];
    case 'membershipType':
      return draft?.membershipType;
  }
}

function hasEnteredValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function toDraft(application: ApplicantMembershipApplicationResponse): Draft {
  return {
    personalInfo: application.personalInfo,
    membershipType: application.membershipType,
    motivation: application.motivation,
    bankingInfo: application.bankingInfo,
  };
}

export default function MembershipApplicantWorkspace({
  navigate = (href) => window.location.assign(href),
}: {
  navigate?: (href: string) => void;
} = {}) {
  const locale = useLocale() as 'de' | 'en' | 'zh';
  const t = useTranslations('common');
  const [application, setApplication] =
    useState<ApplicantMembershipApplicationResponse>();
  const [draft, setDraft] = useState<Draft>();
  const [savedDraft, setSavedDraft] = useState<Draft>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [authoritativeCorrectionFields, setAuthoritativeCorrectionFields] =
    useState<MembershipApplicationSubmissionCorrectionField[]>([]);
  const [pendingHref, setPendingHref] = useState<string>();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [emailChange, setEmailChange] = useState('');
  const [savedProofIds, setSavedProofIds] = useState<string[]>([]);
  const [retainedProofIds, setRetainedProofIds] = useState<string[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [emailDocumentKinds, setEmailDocumentKinds] = useState<
    Array<'application' | 'sepa'>
  >(['application']);

  const bypassNextUnload = useRef(false);
  const dataDirty = useMemo(
    () =>
      Boolean(
        draft &&
          savedDraft &&
          JSON.stringify(draft) !== JSON.stringify(savedDraft)
      ),
    [draft, savedDraft]
  );
  const proofDirty = useMemo(
    () =>
      proofFiles.length > 0 ||
      JSON.stringify(retainedProofIds) !== JSON.stringify(savedProofIds),
    [proofFiles, retainedProofIds, savedProofIds]
  );
  const dirty = dataDirty || proofDirty;
  const submissionReadiness = useMemo(
    () => getMembershipApplicationSubmissionReadiness(draft),
    [draft]
  );
  const submissionCorrectionFields = useMemo(
    () => [
      ...new Set([
        ...submissionReadiness.fields,
        ...authoritativeCorrectionFields,
      ]),
    ],
    [authoritativeCorrectionFields, submissionReadiness.fields]
  );
  const submissionReady =
    submissionReadiness.ready && authoritativeCorrectionFields.length === 0;
  const missingSubmissionRequiredFields = useMemo(
    () =>
      submissionCorrectionFields.filter(
        (field) =>
          SUBMISSION_REQUIRED_FIELDS.has(field) &&
          !hasEnteredValue(getDraftFieldValue(draft, field))
      ),
    [draft, submissionCorrectionFields]
  );
  const editable =
    application?.status === 'draft' || application?.status === 'pending';

  useEffect(() => {
    void getApplicantApplication()
      .then((loaded) => {
        const value = toDraft(loaded);
        setApplication(loaded);
        setDraft(value);
        setSavedDraft(value);
        const proofIds = loaded.studentProof.map((proof) => proof.id);
        setSavedProofIds(proofIds);
        setRetainedProofIds(proofIds);
      })
      .catch(() => setMessage(t('membershipApplicant.sessionInvalid')));
  }, [t]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (bypassNextUnload.current) {
        bypassNextUnload.current = false;
        return;
      }
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function interceptNavigation(event: MouseEvent) {
      if (!dirty || event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest('a');
      if (!anchor || anchor.target === '_blank') return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      event.preventDefault();
      setPendingHref(destination.href);
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', interceptNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', interceptNavigation, true);
    };
  }, [dirty]);

  function navigateToPending(href: string) {
    bypassNextUnload.current = true;
    try {
      navigate(href);
    } catch (error) {
      bypassNextUnload.current = false;
      throw error;
    }
  }

  function updatePersonal(field: string, value: string) {
    setAuthoritativeCorrectionFields((current) =>
      current.filter((candidate) => candidate !== field)
    );
    setDraft((current) =>
      current
        ? {
            ...current,
            personalInfo: { ...current.personalInfo, [field]: value },
          }
        : current
    );
  }

  function updateAddress(field: string, value: string) {
    setAuthoritativeCorrectionFields((current) =>
      current.filter((candidate) => candidate !== field)
    );
    setDraft((current) =>
      current
        ? {
            ...current,
            personalInfo: {
              ...current.personalInfo,
              address: {
                ...current.personalInfo?.address,
                [field]: value,
                country: 'Deutschland',
              },
            },
          }
        : current
    );
  }

  function changeAccountHolderType(value: 'same' | 'different') {
    if (!draft?.bankingInfo) return;
    const { bankName, bic, iban, debitFrequency } = draft.bankingInfo;
    setDraft({
      ...draft,
      bankingInfo:
        value === 'same'
          ? { accountHolderType: 'same', bankName, bic, iban, debitFrequency }
          : {
              accountHolderType: 'different',
              bankName,
              bic,
              iban,
              debitFrequency,
            },
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await saveApplicantApplication(draft);
      const value = toDraft(saved);
      setApplication(saved);
      setDraft(value);
      setSavedDraft(value);
      setMessage(t('membershipApplicant.saveSuccess'));
    } catch {
      setMessage(t('membershipApplicant.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMessage('');
    try {
      if (dataDirty && draft) {
        const saved = await saveApplicantApplication(draft);
        const savedValue = toDraft(saved);
        setApplication(saved);
        setDraft(savedValue);
        setSavedDraft(savedValue);
      }
      const submitted = await submitApplicantDraft();
      const value = toDraft(submitted);
      setApplication(submitted);
      setDraft(value);
      setSavedDraft(value);
      setAuthoritativeCorrectionFields([]);
      setMessage(t('membershipApplicant.submitSuccess'));
    } catch (error) {
      const fields = getApplicantSubmissionCorrectionFields(error);
      if (fields) {
        setAuthoritativeCorrectionFields(fields);
        setMessage(t('membershipApplicant.submitNeedsCorrection'));
      } else {
        setMessage(t('membershipApplicant.submitFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function persistProofChanges() {
    const saved = await replaceApplicantStudentProof(
      retainedProofIds,
      proofFiles
    );
    setApplication(saved);
    const proofIds = saved.studentProof.map((proof) => proof.id);
    setSavedProofIds(proofIds);
    setRetainedProofIds(proofIds);
    setProofFiles([]);
    return saved;
  }

  async function saveProofs() {
    setBusy(true);
    setMessage('');
    try {
      await persistProofChanges();
      setMessage(t('membershipApplicant.proofSaveSuccess'));
    } catch {
      setMessage(t('membershipApplicant.proofSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function downloadDocument(kind: 'application' | 'sepa') {
    setBusy(true);
    try {
      const blob = await downloadApplicantDocument(kind);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        kind === 'application'
          ? 'membership-application.pdf'
          : 'sepa-mandate.pdf';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage(t('membershipApplicant.documentGenerateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function changeCommunicationLocale(nextLocale: 'de' | 'en' | 'zh') {
    if (nextLocale === application?.communicationLocale) return;
    setBusy(true);
    setMessage('');
    try {
      await synchronizeApplicantCommunicationLocale(nextLocale);
      setApplication((current) =>
        current ? { ...current, communicationLocale: nextLocale } : current
      );
      navigateToPending(`/${nextLocale}/apply/continue`);
    } catch {
      setMessage(t('membershipApplicant.localeChangeFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function saveAndLeave() {
    if (!pendingHref || !draft) return;
    const href = pendingHref;
    setBusy(true);
    setMessage('');
    let dataSaved = false;
    let proofSaved = false;
    const saveProofFirst =
      proofDirty &&
      application?.membershipType === 'student' &&
      draft.membershipType !== 'student';
    try {
      if (saveProofFirst) {
        await persistProofChanges();
        proofSaved = true;
      }
      if (dataDirty) {
        const saved = await saveApplicantApplication(draft);
        const savedValue = toDraft(saved);
        setApplication(saved);
        setDraft(savedValue);
        setSavedDraft(savedValue);
        dataSaved = true;
      }
      if (proofDirty && !proofSaved) {
        await persistProofChanges();
        proofSaved = true;
      }
      setPendingHref(undefined);
      navigateToPending(href);
    } catch {
      setPendingHref(undefined);
      setMessage(
        t(
          dataSaved && proofDirty
            ? 'membershipApplicant.saveLeavePartialFailed'
            : proofSaved && dataDirty
              ? 'membershipApplicant.saveLeaveProofPartialFailed'
              : 'membershipApplicant.saveLeaveFailed'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    setMessage('');
    try {
      await withdrawApplicantApplication();
      setApplication({
        ...application!,
        status: MemberApplicationStatus.WITHDRAWN,
        withdrawnAt: new Date().toISOString(),
      });
      setSavedDraft(draft);
      setSavedProofIds(retainedProofIds);
      setProofFiles([]);
      setMessage(t('membershipApplicant.withdrawSuccess'));
      setWithdrawOpen(false);
    } catch {
      setMessage(t('membershipApplicant.withdrawFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!application || !draft) {
    return (
      <Card>
        <CardContent className="p-8 text-center" role="status">
          {message || t('membershipApplicant.loading')}
        </CardContent>
      </Card>
    );
  }

  const personal = draft.personalInfo ?? {};
  const address = personal.address ?? {};
  const banking = draft.bankingInfo;
  const correctionLabel = (
    field: MembershipApplicationSubmissionCorrectionField
  ): string => {
    const labels: Record<
      MembershipApplicationSubmissionCorrectionField,
      string
    > = {
      firstName: t('applicationForm.firstName'),
      lastName: t('applicationForm.lastName'),
      phone: t('applicationForm.phone'),
      dateOfBirth: t('applicationForm.birthday'),
      gender: t('applicationForm.gender'),
      street: t('applicationForm.address'),
      city: t('applicationForm.city'),
      postalCode: t('applicationForm.postalCode'),
      membershipType: t('applicationForm.membershipType'),
    };
    return labels[field];
  };
  const fieldNeedsCorrection = (
    field: MembershipApplicationSubmissionCorrectionField
  ) => submissionCorrectionFields.includes(field);
  const fieldHasInvalidValue = (
    field: MembershipApplicationSubmissionCorrectionField,
    value: unknown
  ) =>
    fieldNeedsCorrection(field) &&
    (authoritativeCorrectionFields.includes(field) || hasEnteredValue(value));
  const correctionDescriptionId = (
    field: MembershipApplicationSubmissionCorrectionField,
    value: unknown
  ) => {
    if (!fieldNeedsCorrection(field)) return undefined;
    if (hasEnteredValue(value)) return `applicant-${field}-correction`;
    if (
      application.status === 'draft' &&
      SUBMISSION_REQUIRED_FIELDS.has(field)
    ) {
      return 'applicant-submission-readiness';
    }
    return undefined;
  };
  const correctionHelper = (
    field: MembershipApplicationSubmissionCorrectionField,
    value: unknown
  ) =>
    fieldNeedsCorrection(field) &&
    hasEnteredValue(value) && (
      <span
        id={`applicant-${field}-correction`}
        className="text-xs font-normal text-destructive"
      >
        {t('membershipApplicant.fieldNeedsCorrection')}
      </span>
    );

  const fieldNote = (text: string, id?: string) => (
    <span id={id} className="text-xs font-normal text-muted-foreground">
      ({text})
    </span>
  );
  const requiredMarker = () => (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('membershipApplicant.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('membershipApplicant.status', {
              status: t(
                `membershipApplicant.statusLabels.${application.status}`
              ),
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('membershipApplicant.retentionNotice')}
          </p>
          <Label
            htmlFor="applicant-communication-locale"
            className="max-w-xs flex-col items-start gap-2"
          >
            {t('membershipApplicant.communicationLanguage')}
            <Select
              value={application?.communicationLocale ?? 'de'}
              disabled={busy || dirty || !editable}
              onValueChange={(value) =>
                void changeCommunicationLocale(value as 'de' | 'en' | 'zh')
              }
            >
              <SelectTrigger
                id="applicant-communication-locale"
                className="h-10 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="de">
                  {t('membershipApplicant.localeLabels.de')}
                </SelectItem>
                <SelectItem value="en">
                  {t('membershipApplicant.localeLabels.en')}
                </SelectItem>
                <SelectItem value="zh">
                  {t('membershipApplicant.localeLabels.zh')}
                </SelectItem>
              </SelectContent>
            </Select>
          </Label>
        </CardHeader>
        <CardContent className="space-y-8">
          {message && (
            <p className="rounded-md border p-3 text-sm" role="status">
              {message}
            </p>
          )}
          {(application.rejectionReason || application.approvalMessage) && (
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <p>
                <span className="font-medium">
                  {t('membershipApplicant.decision')}:
                </span>{' '}
                {application.rejectionReason ?? application.approvalMessage}
              </p>
            </div>
          )}
          <fieldset
            className="grid gap-4 sm:grid-cols-2"
            disabled={!editable || busy}
          >
            <legend className="col-span-full mb-2 text-lg font-semibold">
              {t('membershipApplicant.personal')}
            </legend>
            <p className="col-span-full text-sm text-muted-foreground">
              <span aria-hidden="true" className="text-destructive">
                *
              </span>{' '}
              {t('membershipApplicant.requiredToSubmit')}
            </p>
            {(
              [
                ['firstName', t('applicationForm.firstName'), 'text'],
                ['lastName', t('applicationForm.lastName'), 'text'],
                ['phone', t('applicationForm.phone'), 'tel'],
                ['dateOfBirth', t('applicationForm.birthday'), 'date'],
              ] as const
            ).map(([field, label, type]) => (
              <Label
                className="flex-col items-start gap-2"
                key={field}
                htmlFor={`applicant-${field}`}
              >
                <span className="flex flex-wrap items-baseline gap-1">
                  {label} {field !== 'phone' && requiredMarker()}
                </span>
                <Input
                  id={`applicant-${field}`}
                  aria-label={label}
                  type={type}
                  value={personal[field] ?? ''}
                  required={field !== 'phone'}
                  aria-invalid={fieldHasInvalidValue(field, personal[field])}
                  aria-describedby={correctionDescriptionId(
                    field,
                    personal[field]
                  )}
                  onChange={(e) => updatePersonal(field, e.target.value)}
                />
                {correctionHelper(field, personal[field])}
              </Label>
            ))}
            <Label className="flex-col items-start gap-2">
              {t('membershipApplicant.verifiedEmail')}
              <Input value={application.verifiedEmail} disabled />
            </Label>
            <Label
              htmlFor="applicant-gender"
              className="flex-col items-start gap-2"
            >
              <span className="flex flex-wrap items-baseline gap-1">
                {t('applicationForm.gender')} {requiredMarker()}
              </span>
              <Select
                value={personal.gender ?? ''}
                onValueChange={(value) =>
                  updatePersonal(
                    'gender',
                    value === CLEAR_APPLICANT_SELECT_VALUE ? '' : value
                  )
                }
              >
                <SelectTrigger
                  id="applicant-gender"
                  aria-label={t('applicationForm.gender')}
                  className="h-10 w-full"
                  aria-required="true"
                  aria-invalid={fieldHasInvalidValue('gender', personal.gender)}
                  aria-describedby={correctionDescriptionId(
                    'gender',
                    personal.gender
                  )}
                >
                  <SelectValue placeholder={t('membershipApplicant.select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLEAR_APPLICANT_SELECT_VALUE}>
                    {t('membershipApplicant.select')}
                  </SelectItem>
                  <SelectItem value="female">
                    {t('applicationForm.genderOptions.female')}
                  </SelectItem>
                  <SelectItem value="male">
                    {t('applicationForm.genderOptions.male')}
                  </SelectItem>
                  <SelectItem value="non-binary">
                    {t('applicationForm.genderOptions.other')}
                  </SelectItem>
                </SelectContent>
              </Select>
              {correctionHelper('gender', personal.gender)}
            </Label>
            {(
              [
                ['street', t('applicationForm.address')],
                ['city', t('applicationForm.city')],
                ['postalCode', t('applicationForm.postalCode')],
              ] as const
            ).map(([field, label]) => (
              <Label
                className="flex-col items-start gap-2"
                key={field}
                htmlFor={`applicant-${field}`}
              >
                <span className="flex flex-wrap items-baseline gap-1">
                  {label} {requiredMarker()}
                </span>
                <Input
                  id={`applicant-${field}`}
                  aria-label={label}
                  value={address[field] ?? ''}
                  required
                  aria-invalid={fieldHasInvalidValue(field, address[field])}
                  aria-describedby={correctionDescriptionId(
                    field,
                    address[field]
                  )}
                  onChange={(e) => updateAddress(field, e.target.value)}
                />
                {correctionHelper(field, address[field])}
              </Label>
            ))}
            <Label className="flex-col items-start gap-2">
              {t('applicationForm.country')}
              <div className="h-10 w-full rounded-md border bg-muted px-3 py-2 text-sm">
                {t('membershipApplicant.germany')}
              </div>
            </Label>
            <Label
              htmlFor="applicant-membership-type"
              className="flex-col items-start gap-2"
            >
              <span className="flex flex-wrap items-baseline gap-1">
                {t('applicationForm.membershipType')} {requiredMarker()}
              </span>
              <Select
                value={draft.membershipType ?? ''}
                onValueChange={(value) => {
                  setAuthoritativeCorrectionFields((current) =>
                    current.filter((field) => field !== 'membershipType')
                  );
                  setDraft({
                    ...draft,
                    membershipType: (value === CLEAR_APPLICANT_SELECT_VALUE
                      ? ''
                      : value) as 'regular' | 'student',
                  });
                }}
              >
                <SelectTrigger
                  id="applicant-membership-type"
                  aria-label={t('applicationForm.membershipType')}
                  className="h-10 w-full"
                  aria-required="true"
                  aria-invalid={fieldHasInvalidValue(
                    'membershipType',
                    draft.membershipType
                  )}
                  aria-describedby={correctionDescriptionId(
                    'membershipType',
                    draft.membershipType
                  )}
                >
                  <SelectValue placeholder={t('membershipApplicant.select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLEAR_APPLICANT_SELECT_VALUE}>
                    {t('membershipApplicant.select')}
                  </SelectItem>
                  <SelectItem value="regular">
                    {t('applicationForm.membershipTypes.regular')}
                  </SelectItem>
                  <SelectItem value="student">
                    {t('applicationForm.membershipTypes.student')}
                  </SelectItem>
                </SelectContent>
              </Select>
              {correctionHelper('membershipType', draft.membershipType)}
            </Label>
            <Label className="flex-col items-start gap-2 sm:col-span-2">
              <span>{t('membershipApplicant.motivation')}</span>
              <Input
                aria-label={t('membershipApplicant.motivation')}
                value={draft.motivation ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, motivation: e.target.value })
                }
              />
            </Label>
          </fieldset>

          {editable && (
            <fieldset
              className="space-y-4"
              disabled={busy}
              aria-describedby="applicant-bank-timing"
            >
              <legend className="text-lg font-semibold">
                {t('membershipApplicant.banking')}
              </legend>
              <p
                id="applicant-bank-timing"
                className="text-sm text-muted-foreground"
              >
                {t('membershipApplicant.bankLater')}
              </p>
              {!banking ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      bankingInfo: { accountHolderType: 'same' },
                    })
                  }
                >
                  {t('membershipApplicant.addBank')}
                </Button>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Label
                    htmlFor="applicant-account-holder"
                    className="flex-col items-start gap-2"
                  >
                    <span>{t('applicationForm.accountHolderSelection')}</span>
                    <Select
                      value={banking.accountHolderType}
                      onValueChange={(value) =>
                        changeAccountHolderType(value as 'same' | 'different')
                      }
                    >
                      <SelectTrigger
                        id="applicant-account-holder"
                        aria-label={t('applicationForm.accountHolderSelection')}
                        className="h-10 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same">
                          {t('applicationForm.accountHolderOptions.same')}
                        </SelectItem>
                        <SelectItem value="different">
                          {t('applicationForm.accountHolderOptions.different')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                  {(
                    [
                      ['bankName', t('applicationForm.bankName')],
                      ['bic', t('applicationForm.bic')],
                      ['iban', t('applicationForm.iban')],
                    ] as const
                  ).map(([field, label]) => (
                    <Label className="flex-col items-start gap-2" key={field}>
                      <span className="flex flex-wrap items-baseline gap-1">
                        {label}{' '}
                        {field === 'bic' &&
                          fieldNote(
                            t('membershipApplicant.optional'),
                            'applicant-bic-optionality'
                          )}
                      </span>
                      <Input
                        aria-label={label}
                        value={banking[field] ?? ''}
                        aria-describedby={
                          field === 'bic'
                            ? 'applicant-bic-optionality'
                            : undefined
                        }
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            bankingInfo: {
                              ...banking,
                              [field]: e.target.value,
                            },
                          })
                        }
                      />
                    </Label>
                  ))}
                  <Label
                    htmlFor="applicant-debit-frequency"
                    className="flex-col items-start gap-2"
                  >
                    <span>{t('membershipApplicant.frequency')}</span>
                    <Select
                      value={banking.debitFrequency ?? ''}
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          bankingInfo: {
                            ...banking,
                            debitFrequency: (value ===
                            CLEAR_APPLICANT_SELECT_VALUE
                              ? ''
                              : value) as 'quarterly' | 'annually',
                          },
                        })
                      }
                    >
                      <SelectTrigger
                        id="applicant-debit-frequency"
                        aria-label={t('membershipApplicant.frequency')}
                        className="h-10 w-full"
                      >
                        <SelectValue
                          placeholder={t('membershipApplicant.select')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CLEAR_APPLICANT_SELECT_VALUE}>
                          {t('membershipApplicant.select')}
                        </SelectItem>
                        <SelectItem value="quarterly">
                          {t('membershipApplicant.quarterly')}
                        </SelectItem>
                        <SelectItem value="annually">
                          {t('membershipApplicant.annually')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                  {banking.accountHolderType === 'different' &&
                    (
                      [
                        [
                          'accountHolderFirstName',
                          t('applicationForm.accountHolderFirstName'),
                        ],
                        [
                          'accountHolderLastName',
                          t('applicationForm.accountHolderLastName'),
                        ],
                        [
                          'accountHolderAddress',
                          t('applicationForm.accountHolderAddress'),
                        ],
                      ] as const
                    ).map(([field, label]) => (
                      <Label className="flex-col items-start gap-2" key={field}>
                        <span>{label}</span>
                        <Input
                          aria-label={label}
                          value={banking[field] ?? ''}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              bankingInfo: {
                                ...banking,
                                [field]: e.target.value,
                              },
                            })
                          }
                        />
                      </Label>
                    ))}
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDraft({ ...draft, bankingInfo: null })}
                    >
                      {t('membershipApplicant.removeBank')}
                    </Button>
                  </div>
                </div>
              )}
            </fieldset>
          )}

          {editable && application.membershipType === 'student' && (
            <section className="space-y-4 border-t pt-6">
              <div>
                <h2 className="text-lg font-semibold">
                  {t('membershipApplicant.proofTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('membershipApplicant.proofGuidance')}
                </p>
              </div>
              {application.studentProof.map(
                (proof) =>
                  retainedProofIds.includes(proof.id) && (
                    <div
                      className="flex items-center justify-between rounded-md border p-3 text-sm"
                      key={proof.id}
                    >
                      <span>
                        {proof.originalName} (
                        {t('membershipApplicant.proofSize', {
                          size: Math.ceil(proof.size / 1024),
                        })}
                        )
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRetainedProofIds((ids) =>
                            ids.filter((id) => id !== proof.id)
                          )
                        }
                      >
                        {t('membershipApplicant.proofRemove')}
                      </Button>
                    </div>
                  )
              )}
              <Input
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) =>
                  setProofFiles(Array.from(event.target.files ?? []))
                }
              />
              <Button
                type="button"
                variant="outline"
                disabled={
                  busy ||
                  (proofFiles.length === 0 &&
                    retainedProofIds.length === application.studentProof.length)
                }
                onClick={saveProofs}
              >
                {t('membershipApplicant.proofSave')}
              </Button>
            </section>
          )}

          {application.status === 'pending' && (
            <section className="space-y-4 border-t pt-6">
              <div>
                <h2 className="text-lg font-semibold">
                  {t('membershipApplicant.documentsTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t('membershipApplicant.documentsGuidance')}
                </p>
              </div>
              {(application.signedApplicationReceipt?.resetAt ||
                application.signedSepaReceipt?.resetAt) && (
                <p
                  className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                  role="alert"
                >
                  {t('membershipApplicant.receiptReset')}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void downloadDocument('application')}
                >
                  {t('membershipApplicant.downloadApplication')}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !application.bankingSummary.complete}
                  onClick={() => void downloadDocument('sepa')}
                >
                  {t('membershipApplicant.downloadSepa')}
                </Button>
              </div>
              <div className="space-y-2 rounded-md border p-4">
                <p className="text-sm font-medium">
                  {t('membershipApplicant.emailCurrentDocuments', {
                    email: application.verifiedEmail,
                  })}
                </p>
                {(['application', 'sepa'] as const).map((kind) => (
                  <label className="flex items-center gap-2 text-sm" key={kind}>
                    <input
                      type="checkbox"
                      checked={emailDocumentKinds.includes(kind)}
                      disabled={
                        kind === 'sepa' && !application.bankingSummary.complete
                      }
                      onChange={(event) =>
                        setEmailDocumentKinds((current) =>
                          event.target.checked
                            ? [...new Set([...current, kind])]
                            : current.filter((value) => value !== kind)
                        )
                      }
                    />
                    {kind === 'application'
                      ? t('membershipApplicant.applicationDocument')
                      : t('membershipApplicant.sepaDocument')}
                  </label>
                ))}
                <Button
                  variant="outline"
                  disabled={busy || emailDocumentKinds.length === 0}
                  onClick={() => {
                    setBusy(true);
                    void emailApplicantDocuments(emailDocumentKinds)
                      .then(() =>
                        setMessage(
                          t('membershipApplicant.emailDocumentsSuccess')
                        )
                      )
                      .catch(() =>
                        setMessage(
                          t('membershipApplicant.emailDocumentsFailed')
                        )
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  {t('membershipApplicant.emailSelectedDocuments')}
                </Button>
              </div>
            </section>
          )}

          {editable && (
            <div className="space-y-3">
              {application.status === 'draft' &&
                missingSubmissionRequiredFields.length > 0 && (
                  <div
                    id="applicant-submission-readiness"
                    className="rounded-md border bg-muted/40 p-3 text-sm"
                    role="status"
                  >
                    <p className="font-medium">
                      {t('membershipApplicant.missingRequiredCount', {
                        count: missingSubmissionRequiredFields.length,
                      })}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {missingSubmissionRequiredFields
                        .map(correctionLabel)
                        .join(' · ')}
                    </p>
                  </div>
                )}
              <div className="flex flex-wrap gap-3">
                <Button disabled={!dataDirty || busy} onClick={save}>
                  {t('membershipApplicant.save')}
                </Button>
                {application.status === 'draft' && (
                  <Button disabled={busy || !submissionReady} onClick={submit}>
                    {t('membershipApplicant.submit')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {application.status === 'pending' && (
            <div className="space-y-4 border-t pt-6">
              <h2 className="font-semibold">
                {t('membershipApplicant.changeEmail')}
              </h2>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={emailChange}
                  onChange={(e) => setEmailChange(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={!emailChange || busy}
                  onClick={() => {
                    setBusy(true);
                    void requestApplicantEmailChange(emailChange, locale)
                      .then(() =>
                        setMessage(t('membershipApplicant.emailChangeSuccess'))
                      )
                      .catch(() =>
                        setMessage(t('membershipApplicant.emailChangeFailed'))
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  {t('membershipApplicant.verifyNewEmail')}
                </Button>
              </div>
              <Button
                variant="destructive"
                onClick={() => setWithdrawOpen(true)}
              >
                {t('membershipApplicant.withdraw')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(pendingHref)}
        onOpenChange={(open) => !open && setPendingHref(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('membershipApplicant.leaveTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('membershipApplicant.leaveDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t('membershipApplicant.continueEditing')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!pendingHref) return;
                const href = pendingHref;
                setPendingHref(undefined);
                navigateToPending(href);
              }}
            >
              {t('membershipApplicant.leaveWithoutSaving')}
            </AlertDialogAction>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void saveAndLeave()}
            >
              {t('membershipApplicant.saveAndLeave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('membershipApplicant.confirmWithdraw')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('membershipApplicant.withdrawDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('membershipApplicant.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => void withdraw()}
            >
              {t('membershipApplicant.confirmWithdrawAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
