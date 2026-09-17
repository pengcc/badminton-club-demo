'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MEMBER_CSV_HEADERS,
  type MemberCsvApply,
  type MemberCsvPreview,
  type MemberCsvResult,
} from '@club/shared-types/api/memberCsv';
import { Modal } from '@app/components/ui/modal';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { UserService } from '@app/services/userService';

export default function MemberCsvImportModal({
  onClose,
  returnFocusTo,
}: {
  onClose: () => void;
  returnFocusTo?: () => HTMLElement | null;
}) {
  const t = useTranslations('dashboard.memberImport');
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<MemberCsvPreview>();
  const [result, setResult] = useState<MemberCsvResult>();
  const [status, setStatus] = useState<'preview' | MemberCsvApply['status']>();
  const [error, setError] = useState(false);
  const [auditWarning, setAuditWarning] = useState(false);
  const previewMutation = UserService.usePreviewMemberCsv();
  const applyMutation = UserService.useApplyMemberCsv();
  const busy = previewMutation.isPending || applyMutation.isPending;
  const count = preview ? preview.counts.create + preview.counts.update : 0;
  async function showPreview() {
    if (!file || busy) return;
    setPreview(undefined);
    setResult(undefined);
    setStatus(undefined);
    setError(false);
    setAuditWarning(false);
    try {
      const next = await previewMutation.mutateAsync(file);
      setPreview(next);
      setResult(next);
      setStatus('preview');
    } catch {
      setError(true);
    }
  }
  async function apply() {
    if (!file || !preview || busy || !count) return;
    setError(false);
    setAuditWarning(false);
    setPreview(undefined);
    try {
      const next = await applyMutation.mutateAsync({
        file,
        previewContext: preview.previewContext,
      });
      setResult(next);
      setStatus(next.status);
      setAuditWarning(next.auditSummary === 'failed');
    } catch {
      setError(true);
      setStatus('incomplete');
    }
  }
  return (
    <Modal
      isOpen
      onClose={busy ? undefined : onClose}
      ariaLabel={t('title')}
      returnFocusTo={returnFocusTo}
    >
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{t('guidance')}</p>
          <details className="text-sm">
            <summary className="cursor-pointer">{t('format')}</summary>
            <p className="mt-2">{t('values')}</p>
            <ul className="mt-2 grid list-inside list-disc gap-1 sm:grid-cols-2">
              {MEMBER_CSV_HEADERS.map((header) => (
                <li key={header}>{header}</li>
              ))}
            </ul>
          </details>
          <div className="space-y-2">
            <Label htmlFor="member-csv-file">{t('file')}</Label>
            <Input
              id="member-csv-file"
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setPreview(undefined);
                setResult(undefined);
                setStatus(undefined);
                setError(false);
                setAuditWarning(false);
                previewMutation.reset();
                applyMutation.reset();
              }}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {t('error')}
            </p>
          )}
          {auditWarning && (
            <p role="alert" className="text-sm">
              {t('auditWarning')}
            </p>
          )}
          <div role="status" aria-live="polite" className="space-y-2 text-sm">
            {busy ? (
              <p>{t('working')}</p>
            ) : (
              status && <p>{t(`status.${status}`)}</p>
            )}
            {result && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(result.counts).map(([outcome, value]) => (
                  <li key={outcome}>
                    {t(`outcome.${outcome}`)}: {value}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {result && (
            <ol
              className="max-h-80 space-y-2 overflow-y-auto"
              aria-label={t('rows')}
            >
              {result.rows.map((row) => (
                <li
                  key={row.rowNumber}
                  className="space-y-1 border-b py-2 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="min-w-0 break-words">
                      {t('row', { number: row.rowNumber })}: {row.name}
                    </span>
                    <strong>{t(`outcome.${row.outcome}`)}</strong>
                  </div>
                  <p className="text-muted-foreground break-all">{row.email}</p>
                  {row.changes.length > 0 && (
                    <p>
                      {row.changes
                        .map((field) => t(`change.${field}`))
                        .join(', ')}
                    </p>
                  )}
                  {row.reason && <p>{t(`reason.${row.reason}`)}</p>}
                </li>
              ))}
            </ol>
          )}
          {result && (
            <p className="text-muted-foreground text-sm">
              {t('reviewGuidance')}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              {t('close')}
            </Button>
            <Button
              variant={preview ? 'outline' : 'default'}
              disabled={!file || busy}
              onClick={() => void showPreview()}
            >
              {status === 'incomplete' ? t('previewAgain') : t('preview')}
            </Button>
            {preview && (
              <Button
                disabled={!count || busy || status !== 'preview'}
                onClick={() => void apply()}
              >
                {t('apply', { count })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
