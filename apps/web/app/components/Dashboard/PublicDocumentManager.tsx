'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { CONTENT_LANGUAGES } from '@club/shared-types/api/localizedContent';
import {
  publicDocumentCreateValuesSchema,
  publicDocumentUpdateValuesSchema,
} from '@club/shared-types/api/publicDocument';
import { Language } from '@club/shared-types/core/enums';
import type { PublicDocumentAdministration } from '@app/lib/api/publicDocumentApi';
import { PublicDocumentService } from '@app/services/publicDocumentService';
import { usePublication } from '@app/hooks/usePublication';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@app/components/ui/alert-dialog';
import { Badge } from '@app/components/ui/badge';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@app/components/ui/dialog';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/components/ui/tabs';
import { PublicationFailureNotice } from './PublicationFailureNotice';
import { useTranslations } from 'next-intl';

type CleanupWarning = { message: string } | null;

function LocalizedNameFields({
  owner,
  displayName,
  setDisplayName,
}: {
  owner: string;
  displayName: PublicDocumentAdministration['displayName'];
  setDisplayName: React.Dispatch<
    React.SetStateAction<PublicDocumentAdministration['displayName']>
  >;
}) {
  const t = useTranslations('dashboard.cms');
  return (
    <Tabs defaultValue={Language.GERMAN}>
      <TabsList>
        {CONTENT_LANGUAGES.map((language) => (
          <TabsTrigger key={language} value={language}>
            {t(`common.languages.${language}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      {CONTENT_LANGUAGES.map((language) => (
        <TabsContent key={language} value={language}>
          <Label htmlFor={`${owner}-name-${language}`}>
            {t('documents.displayName')}
          </Label>
          <Input
            id={`${owner}-name-${language}`}
            value={displayName[language]}
            onChange={(event) =>
              setDisplayName((current) => ({
                ...current,
                [language]: event.target.value,
              }))
            }
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function AddDocumentDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onSaved(message: string, cleanup: CleanupWarning): Promise<void>;
}) {
  const t = useTranslations('dashboard.cms');
  const create = PublicDocumentService.useCreate();
  const [displayName, setDisplayName] = useState({ de: '', en: '', zh: '' });
  const [documentDate, setDocumentDate] = useState('');
  const [replacement, setReplacement] = useState<File>();

  const save = async () => {
    const parsed = publicDocumentCreateValuesSchema.safeParse({
      displayName,
      documentDate,
      isVisible: true,
    });
    if (!parsed.success || !replacement) {
      toast.error(t('documents.validation'));
      return;
    }
    try {
      const outcome = await create.mutateAsync({
        ...parsed.data,
        replacement,
      });
      setDisplayName({ de: '', en: '', zh: '' });
      setDocumentDate('');
      setReplacement(undefined);
      onOpenChange(false);
      await onSaved(t('documents.created'), outcome.mediaCleanupWarning);
    } catch {
      toast.error(t('documents.createFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('documents.add')}</DialogTitle>
          <DialogDescription>{t('documents.addDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <LocalizedNameFields
            owner="new-public-document"
            displayName={displayName}
            setDisplayName={setDisplayName}
          />
          <div className="space-y-2">
            <Label htmlFor="new-public-document-date">
              {t('documents.date')}
            </Label>
            <Input
              id="new-public-document-date"
              type="date"
              value={documentDate}
              onChange={(event) => setDocumentDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-public-document-pdf">
              {t('documents.pdf')}
            </Label>
            <Input
              id="new-public-document-pdf"
              type="file"
              accept="application/pdf"
              onChange={(event) => setReplacement(event.target.files?.[0])}
            />
          </div>
        </div>
        <DialogFooter showCloseButton closeLabel={t('common.cancel')}>
          <Button disabled={create.isPending} onClick={() => void save()}>
            {create.isPending ? t('common.saving') : t('documents.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublicDocumentEditor({
  document,
  index,
  count,
  ordering,
  onMove,
  onSaved,
}: {
  document: PublicDocumentAdministration;
  index: number;
  count: number;
  ordering: boolean;
  onMove(index: number, direction: -1 | 1): Promise<void>;
  onSaved(message: string, cleanup: CleanupWarning): Promise<void>;
}) {
  const t = useTranslations('dashboard.cms');
  const update = PublicDocumentService.useUpdate();
  const remove = PublicDocumentService.useDelete();
  const [displayName, setDisplayName] = useState(document.displayName);
  const [documentDate, setDocumentDate] = useState(document.documentDate);
  const [retainedFile, setRetainedFile] = useState(document.fileUrl);
  const [isVisible, setIsVisible] = useState(document.isVisible);
  const [replacement, setReplacement] = useState<File>();
  const name = displayName.de || t('documents.unnamed');

  const save = async () => {
    const parsed = publicDocumentUpdateValuesSchema.safeParse({
      displayName,
      documentDate,
      retainedFile,
      isVisible,
    });
    if (!parsed.success) {
      toast.error(t('documents.validation'));
      return;
    }
    try {
      const outcome = await update.mutateAsync({
        id: document.id,
        request: { ...parsed.data, replacement },
      });
      setDisplayName(outcome.document.displayName);
      setDocumentDate(outcome.document.documentDate);
      setRetainedFile(outcome.document.fileUrl);
      setIsVisible(outcome.document.isVisible);
      setReplacement(undefined);
      await onSaved(t('documents.saved'), outcome.mediaCleanupWarning);
    } catch {
      toast.error(t('documents.saveFailed'));
    }
  };

  const permanentlyDelete = async () => {
    try {
      const outcome = await remove.mutateAsync(document.id);
      await onSaved(t('documents.deleted'), outcome.mediaCleanupWarning);
    } catch {
      toast.error(t('documents.deleteFailed'));
    }
  };

  const pending = update.isPending || remove.isPending || ordering;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle role="heading" aria-level={3}>
              {name}
            </CardTitle>
            <CardDescription>
              {t('documents.order', { order: index + 1 })}
            </CardDescription>
          </div>
          <Badge variant={isVisible ? 'secondary' : 'outline'}>
            {isVisible ? t('documents.visible') : t('common.hidden')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <LocalizedNameFields
          owner={document.id}
          displayName={displayName}
          setDisplayName={setDisplayName}
        />
        <div className="space-y-2">
          <Label htmlFor={`${document.id}-date`}>{t('documents.date')}</Label>
          <Input
            id={`${document.id}-date`}
            type="date"
            value={documentDate}
            onChange={(event) => setDocumentDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${document.id}-pdf`}>
            {t('documents.replacement')}
          </Label>
          <Input
            id={`${document.id}-pdf`}
            type="file"
            accept="application/pdf"
            onChange={(event) => setReplacement(event.target.files?.[0])}
          />
          {retainedFile && (
            <p className="break-all text-xs text-muted-foreground">
              {t('documents.current')}: {retainedFile}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label={t('documents.moveUp', { name })}
            disabled={pending || index === 0}
            onClick={() => void onMove(index, -1)}
          >
            <ArrowUp className="mr-2 h-4 w-4" />
            {t('documents.up')}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label={t('documents.moveDown', { name })}
            disabled={pending || index === count - 1}
            onClick={() => void onMove(index, 1)}
          >
            <ArrowDown className="mr-2 h-4 w-4" />
            {t('documents.down')}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label={t(isVisible ? 'documents.hide' : 'documents.show', {
              name,
            })}
            onClick={() => setIsVisible((current) => !current)}
          >
            {isVisible ? (
              <EyeOff className="mr-2 h-4 w-4" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {isVisible ? t('documents.hideAction') : t('documents.showAction')}
          </Button>
          {retainedFile && (
            <Button
              type="button"
              variant="outline"
              aria-label={t('documents.removeNamed', { name })}
              onClick={() => {
                setRetainedFile('');
                setIsVisible(false);
              }}
            >
              {t('documents.remove')}
            </Button>
          )}
          <Button
            aria-label={t('documents.saveNamed', { name })}
            disabled={pending}
            onClick={() => void save()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {update.isPending ? t('common.saving') : t('common.saveAndPublish')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                aria-label={t('documents.deleteNamed', { name })}
                disabled={pending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('documents.deleteAction')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('documents.deleteTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('documents.deleteDescription', { name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void permanentlyDelete()}
                >
                  {t('documents.deleteAction')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicDocumentManager() {
  const t = useTranslations('dashboard.cms');
  const query = PublicDocumentService.useDocuments();
  const reorder = PublicDocumentService.useReorder();
  const publication = usePublication();
  const [adding, setAdding] = useState(false);

  const publish = async (message: string, cleanup: CleanupWarning) => {
    if (await publication.publish('public-documents')) {
      toast[cleanup ? 'warning' : 'success'](
        cleanup
          ? t('documents.mediaCleanupWarning')
          : t('publication.success', { item: message })
      );
    } else {
      toast.warning(
        cleanup
          ? t('documents.mediaCleanupAndRefreshFailed')
          : t('publication.failed', { item: message })
      );
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const ids = (query.data ?? []).map((document) => document.id);
    const target = index + direction;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await reorder.mutateAsync(ids);
      await publish(t('documents.reordered'), null);
    } catch {
      await query.refetch();
      toast.error(t('documents.reorderFailed'));
    }
  };

  if (query.isPending && !query.data) {
    return <p className="py-8 text-center">{t('documents.loading')}</p>;
  }
  if (query.isError && !query.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('documents.loadFailed')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const documents = query.data ?? [];
  return (
    <div className="space-y-6">
      <PublicationFailureNotice
        visible={publication.hasPublicationFailure}
        retrying={publication.isRetrying}
        onRetry={async () => {
          if (await publication.retry())
            toast.success(t('publication.refreshed'));
          else toast.error(t('publication.failedAgain'));
        }}
      />
      {query.isError && query.data && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
        >
          <p className="text-sm">{t('documents.refreshFailed')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            {t('common.retry')}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('documents.title')}</h2>
          <p className="text-muted-foreground">{t('documents.description')}</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('documents.add')}
        </Button>
      </div>
      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('documents.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {documents.map((document, index) => (
            <PublicDocumentEditor
              key={document.id}
              document={document}
              index={index}
              count={documents.length}
              ordering={reorder.isPending}
              onMove={move}
              onSaved={publish}
            />
          ))}
        </div>
      )}
      <AddDocumentDialog
        open={adding}
        onOpenChange={setAdding}
        onSaved={publish}
      />
    </div>
  );
}
