import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import type { Api } from '@club/shared-types/api/match';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Label } from '@app/components/ui/label';
import { Modal } from '@app/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { importFromCSV } from '@app/lib/api/matchApi';
import { matchKeys } from '@app/services/matchService';
import { TeamService } from '@app/services/teamService';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const ZERO_WRITE_IMPORT_ERROR_CODES = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'MATCH_CSV_FILE_REQUIRED',
  'MATCH_CSV_FILE_TOO_LARGE',
  'MATCH_CSV_INVALID_STRUCTURE',
  'MATCH_CSV_INVALID_ENCODING',
  'MATCH_CSV_INVALID_HEADER',
  'MATCH_CSV_NO_DATA_ROWS',
  'MATCH_CSV_TOO_MANY_ROWS',
  'MATCH_CSV_INVALID_FIELDS',
  'TEAM_NOT_FOUND',
]);
const MATCH_CSV_FAILURE_FIELDS = [
  'columns',
  'Datum',
  'Zeit',
  'Sporthalle',
  'Hallenadresse',
  'Heimmannschaft',
  'Gastmannschaft',
  'teamId',
  'opponentName',
  'direction',
  'localDate',
  'localTime',
  'location',
] as const satisfies readonly NonNullable<Api.MatchCsvFailedOutcome['field']>[];
type KnownFailureField = (typeof MATCH_CSV_FAILURE_FIELDS)[number];

function isKnownZeroWriteImportError(error: unknown): boolean {
  const code = (error as { response?: { data?: { code?: unknown } } }).response
    ?.data?.code;
  return typeof code === 'string' && ZERO_WRITE_IMPORT_ERROR_CODES.has(code);
}

function isKnownFailureField(field: unknown): field is KnownFailureField {
  return (
    typeof field === 'string' &&
    MATCH_CSV_FAILURE_FIELDS.includes(field as KnownFailureField)
  );
}

export function CSVUploadModal({ isOpen, onClose }: CSVUploadModalProps) {
  const t = useTranslations('match');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] =
    useState<Api.MatchCsvImportResponse | null>(null);
  const [requestError, setRequestError] = useState<
    'rejected' | 'interrupted' | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: teams, isLoading: teamsLoading } = TeamService.useTeamList();
  const selectedTeam = teams?.find((team) => team.id === selectedTeamId);

  const resetOutcome = () => {
    setImportResult(null);
    setRequestError(null);
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    resetOutcome();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCsvFile(event.target.files?.[0] ?? null);
    resetOutcome();
  };

  const handleImport = async () => {
    if (!csvFile || !selectedTeamId || isImporting) return;
    setIsImporting(true);
    resetOutcome();
    try {
      const result = await importFromCSV(csvFile, selectedTeamId);
      setImportResult(result);
      if (result.summary.created > 0) {
        await queryClient.invalidateQueries({ queryKey: matchKeys.lists() });
      }
      if (result.summary.failed === result.summary.input) {
        toast.error(t('modals.csvImport.allFailed'));
      } else if (
        result.summary.duplicate === result.summary.input &&
        result.summary.created === 0
      ) {
        toast.success(t('modals.csvImport.allDuplicate'));
      } else if (
        result.summary.created === result.summary.input &&
        result.summary.failed === 0
      ) {
        toast.success(t('modals.csvImport.allCreated'));
      } else {
        toast.warning(t('modals.csvImport.mixed'));
      }
    } catch (error) {
      if (isKnownZeroWriteImportError(error)) {
        setRequestError('rejected');
        toast.error(t('modals.csvImport.requestRejectedTitle'));
      } else {
        setRequestError('interrupted');
        await queryClient.invalidateQueries({ queryKey: matchKeys.lists() });
        toast.error(t('modals.csvImport.requestFailedTitle'));
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    setSelectedTeamId('');
    setCsvFile(null);
    resetOutcome();
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const created = importResult?.outcomes.filter(
    (outcome) => outcome.outcome === 'created'
  );
  const duplicates = importResult?.outcomes.filter(
    (outcome) => outcome.outcome === 'duplicate'
  );
  const failures = importResult?.outcomes.filter(
    (outcome) => outcome.outcome === 'failed'
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabel={t('modals.csvImport.title')}
    >
      <Card className="flex max-h-[90vh] w-full max-w-[calc(100vw-2rem)] flex-col sm:max-w-3xl">
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('modals.csvImport.title')}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={isImporting}
              aria-label={t('actions.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="team-select">
                {t('modals.csvImport.selectTeam')}
              </Label>
              <Select
                value={selectedTeamId}
                onValueChange={handleTeamChange}
                disabled={teamsLoading || isImporting}
              >
                <SelectTrigger id="team-select">
                  <SelectValue
                    placeholder={t('modals.csvImport.selectTeamPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {teams?.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.shortName} – {team.leagueTeamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTeam && (
                <p className="text-sm text-muted-foreground">
                  {t('modals.csvImport.teamMatchValue', {
                    team: selectedTeam.leagueTeamName,
                  })}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-md border bg-muted/40 p-4">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4" />
                {t('modals.csvImport.preparationTitle')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('modals.csvImport.preparationDescription')}
              </p>
              <code className="block overflow-x-auto rounded bg-background p-2 text-xs">
                Datum,Zeit,Sporthalle,Hallenadresse,Heimmannschaft,Gastmannschaft
              </code>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-file">{t('modals.csvImport.file')}</Label>
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                disabled={!selectedTeamId || isImporting}
                className="flex-1 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-sm text-muted-foreground">
                {t('modals.csvImport.fileHint')}
              </p>
            </div>

            {csvFile && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-4">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{csvFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(csvFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            {requestError && (
              <div
                className="rounded-md border border-destructive bg-destructive/10 p-4"
                role="alert"
              >
                <h4 className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {t(
                    requestError === 'rejected'
                      ? 'modals.csvImport.requestRejectedTitle'
                      : 'modals.csvImport.requestFailedTitle'
                  )}
                </h4>
                <p className="mt-1 text-sm text-destructive/90">
                  {t(
                    requestError === 'rejected'
                      ? 'modals.csvImport.requestRejectedDescription'
                      : 'modals.csvImport.requestFailedDescription'
                  )}
                </p>
              </div>
            )}

            {importResult && (
              <div className="space-y-4" aria-live="polite">
                <div className="rounded-md border bg-muted/50 p-4">
                  <h4 className="mb-3 text-sm font-medium">
                    {t('modals.csvImport.summary')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {(['input', 'created', 'duplicate', 'failed'] as const).map(
                      (key) => (
                        <div key={key}>
                          <p className="text-xs text-muted-foreground">
                            {t(`modals.csvImport.counts.${key}`)}
                          </p>
                          <p className="text-lg font-semibold">
                            {importResult.summary[key]}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {created && created.length > 0 && (
                  <OutcomeList
                    title={t('modals.csvImport.createdRows', {
                      count: created.length,
                    })}
                    outcomes={created}
                    tone="success"
                    render={(outcome) =>
                      t('modals.csvImport.matchRow', {
                        row: outcome.rowNumber,
                        date: outcome.localDate,
                        time: outcome.localTime,
                        opponent: outcome.opponentName,
                        direction: t(`direction.${outcome.direction}`),
                      })
                    }
                  />
                )}
                {duplicates && duplicates.length > 0 && (
                  <OutcomeList
                    title={t('modals.csvImport.duplicateRows', {
                      count: duplicates.length,
                    })}
                    outcomes={duplicates}
                    tone="warning"
                    render={(outcome) =>
                      t('modals.csvImport.duplicateRow', {
                        row: outcome.rowNumber,
                        date: outcome.localDate,
                        time: outcome.localTime,
                        opponent: outcome.opponentName,
                        direction: t(`direction.${outcome.direction}`),
                        reason: t(
                          `modals.csvImport.duplicateCodes.${outcome.code}`
                        ),
                      })
                    }
                  />
                )}
                {failures && failures.length > 0 && (
                  <OutcomeList
                    title={t('modals.csvImport.failedRows', {
                      count: failures.length,
                    })}
                    outcomes={failures}
                    tone="error"
                    render={(outcome) => {
                      const reason = t(
                        `modals.csvImport.failureCodes.${outcome.code}`
                      );
                      return isKnownFailureField(outcome.field)
                        ? t('modals.csvImport.failedRowWithField', {
                            row: outcome.rowNumber,
                            field: t(
                              `modals.csvImport.failureFields.${outcome.field}`
                            ),
                            reason,
                          })
                        : t('modals.csvImport.failedRow', {
                            row: outcome.rowNumber,
                            reason,
                          });
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </CardContent>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/50 p-6">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
          >
            {importResult || requestError
              ? t('actions.close')
              : t('actions.cancel')}
          </Button>
          <Button
            onClick={handleImport}
            disabled={!csvFile || !selectedTeamId || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('modals.csvImport.importing')}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {t('modals.csvImport.import')}
              </>
            )}
          </Button>
        </div>
      </Card>
    </Modal>
  );
}

function OutcomeList<T extends Api.MatchCsvImportOutcome>({
  title,
  outcomes,
  tone,
  render,
}: {
  title: string;
  outcomes: T[];
  tone: 'success' | 'warning' | 'error';
  render: (outcome: T) => string;
}) {
  const toneClasses = {
    success: 'border-green-200 bg-green-50 dark:bg-green-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:bg-amber-950/20',
    error: 'border-destructive bg-destructive/10',
  };
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-medium">
        {tone === 'success' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        {title}
      </h4>
      <div
        className={`max-h-40 space-y-1 overflow-y-auto rounded-md border p-3 ${toneClasses[tone]}`}
      >
        {outcomes.map((outcome) => (
          <p key={outcome.rowNumber} className="text-xs">
            {render(outcome)}
          </p>
        ))}
      </div>
    </section>
  );
}
