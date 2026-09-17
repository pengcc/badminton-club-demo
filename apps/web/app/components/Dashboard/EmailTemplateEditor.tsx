'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import { Label } from '@app/components/ui/label';
import { Input } from '@app/components/ui/input';
import { Textarea } from '@app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { Mail, Save, Eye, Code, Globe } from 'lucide-react';
import { EmailTemplateService } from '@app/services/emailTemplateService';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function EmailTemplateEditor() {
  const t = useTranslations('dashboard.emailTemplateEditor');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [selectedLocale, setSelectedLocale] = useState<'de' | 'en' | 'zh'>(
    'de'
  );
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [formOwnerId, setFormOwnerId] = useState<string | null>(null);
  const previewRequestVersion = useRef(0);

  // Form state
  const [subjectDe, setSubjectDe] = useState('');
  const [subjectEn, setSubjectEn] = useState('');
  const [subjectZh, setSubjectZh] = useState('');
  const [bodyDe, setBodyDe] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyZh, setBodyZh] = useState('');

  // Fetch templates
  const { data: templates, isLoading } = EmailTemplateService.useTemplateList();
  const {
    data: selectedTemplate,
    isError: isTemplateError,
    isFetching: isTemplateFetching,
    refetch: refetchTemplate,
  } = EmailTemplateService.useTemplate(selectedTemplateId);
  const updateMutation = EmailTemplateService.useUpdateTemplate();
  const previewMutation = EmailTemplateService.usePreviewTemplate();

  // Load template data when selected
  useEffect(() => {
    if (
      selectedTemplate &&
      selectedTemplate._id === selectedTemplateId &&
      formOwnerId === null &&
      !isTemplateFetching &&
      !isTemplateError
    ) {
      setSubjectDe(selectedTemplate.subject.de);
      setSubjectEn(selectedTemplate.subject.en);
      setSubjectZh(selectedTemplate.subject.zh);
      setBodyDe(selectedTemplate.body.de);
      setBodyEn(selectedTemplate.body.en);
      setBodyZh(selectedTemplate.body.zh);
      setFormOwnerId(selectedTemplate._id);
    }
  }, [
    selectedTemplate,
    selectedTemplateId,
    formOwnerId,
    isTemplateFetching,
    isTemplateError,
  ]);

  const invalidatePreview = () => {
    previewRequestVersion.current += 1;
    setShowPreview(false);
    setPreviewResult(null);
  };

  const handleTemplateSelection = (id: string | null) => {
    invalidatePreview();
    setSelectedTemplateId(id);
    setFormOwnerId(null);
    setSubjectDe('');
    setSubjectEn('');
    setSubjectZh('');
    setBodyDe('');
    setBodyEn('');
    setBodyZh('');
  };

  const editorReady =
    Boolean(selectedTemplateId) && formOwnerId === selectedTemplateId;

  const handleSave = async () => {
    if (!selectedTemplateId || !editorReady) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedTemplateId,
        data: {
          subject: {
            de: subjectDe,
            en: subjectEn,
            zh: subjectZh,
          },
          body: {
            de: bodyDe,
            en: bodyEn,
            zh: bodyZh,
          },
        },
      });
      toast.success(t('saved'));
    } catch {
      toast.error(t('saveFailed'));
    }
  };

  const handlePreview = async () => {
    if (!selectedTemplateId || !selectedTemplate || !editorReady) return;

    // Generate sample variables
    const sampleVars: Record<string, string> = {};
    const availableVariables =
      selectedTemplate.systemContract.senderStatus === 'current'
        ? selectedTemplate.systemContract.availableVariables
        : selectedTemplate.variables;
    availableVariables.forEach((varName) => {
      sampleVars[varName] = `[${varName}]`;
    });

    try {
      const requestVersion = ++previewRequestVersion.current;
      const result = await previewMutation.mutateAsync({
        id: selectedTemplateId,
        data: {
          locale: selectedLocale,
          variables: sampleVars,
          subject: { de: subjectDe, en: subjectEn, zh: subjectZh },
          body: { de: bodyDe, en: bodyEn, zh: bodyZh },
        },
      });
      if (requestVersion !== previewRequestVersion.current) return;
      setPreviewResult(result);
      setShowPreview(true);
    } catch {
      toast.error(t('previewFailed'));
    }
  };

  const insertVariable = (varName: string) => {
    invalidatePreview();
    const variable = `{{${varName}}}`;

    // Insert into current locale's body
    if (selectedLocale === 'de') {
      setBodyDe(bodyDe + variable);
    } else if (selectedLocale === 'en') {
      setBodyEn(bodyEn + variable);
    } else {
      setBodyZh(bodyZh + variable);
    }
  };

  const getCurrentSubject = () => {
    switch (selectedLocale) {
      case 'de':
        return subjectDe;
      case 'en':
        return subjectEn;
      case 'zh':
        return subjectZh;
    }
  };

  const getCurrentBody = () => {
    switch (selectedLocale) {
      case 'de':
        return bodyDe;
      case 'en':
        return bodyEn;
      case 'zh':
        return bodyZh;
    }
  };

  const setCurrentSubject = (value: string) => {
    invalidatePreview();
    switch (selectedLocale) {
      case 'de':
        setSubjectDe(value);
        break;
      case 'en':
        setSubjectEn(value);
        break;
      case 'zh':
        setSubjectZh(value);
        break;
    }
  };

  const setCurrentBody = (value: string) => {
    invalidatePreview();
    switch (selectedLocale) {
      case 'de':
        setBodyDe(value);
        break;
      case 'en':
        setBodyEn(value);
        break;
      case 'zh':
        setBodyZh(value);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>{t('selectLabel')}</Label>
              <Select
                value={selectedTemplateId || ''}
                onValueChange={(value) =>
                  handleTemplateSelection(value || null)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template) => (
                    <SelectItem key={template._id} value={template._id}>
                      {template.name
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                      {' — '}
                      {template.systemContract.senderStatus === 'current'
                        ? t('senderCurrent')
                        : t('senderMissing')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && editorReady && (
              <div className="space-y-3 rounded-lg bg-muted/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      selectedTemplate.systemContract.senderStatus === 'current'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {selectedTemplate.systemContract.senderStatus === 'current'
                      ? t('senderCurrent')
                      : t('unconsumed')}
                  </Badge>
                  <Badge
                    variant={
                      selectedTemplate.isActive ? 'secondary' : 'outline'
                    }
                  >
                    {t('catalogStatus', {
                      status: selectedTemplate.isActive
                        ? t('active')
                        : t('inactive'),
                    })}
                  </Badge>
                </div>
                {selectedTemplate.systemContract.senderStatus === 'current' ? (
                  <p className="text-sm text-muted-foreground">
                    {t('ownerLocales', {
                      owner:
                        selectedTemplate.systemContract.owner ??
                        t('unknownOwner'),
                      locales:
                        selectedTemplate.systemContract.supportedLocales.join(
                          ', '
                        ),
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('unconsumedDescription')}
                  </p>
                )}
                <div className="text-sm font-medium">
                  {selectedTemplate.systemContract.senderStatus === 'current'
                    ? t('requiredVariables')
                    : t('catalogVariables')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selectedTemplate.systemContract.senderStatus === 'current'
                    ? selectedTemplate.systemContract.requiredVariables
                    : selectedTemplate.variables
                  ).map((varName) => (
                    <Button
                      key={varName}
                      size="sm"
                      variant="outline"
                      onClick={() => insertVariable(varName)}
                      className="text-xs"
                      aria-label={t('insertVariable', { variable: varName })}
                    >
                      <Code className="h-3 w-3 mr-1" />
                      {varName}
                    </Button>
                  ))}
                </div>
                {selectedTemplate.systemContract.senderStatus === 'current' &&
                  selectedTemplate.systemContract.availableVariables.some(
                    (variable) =>
                      !selectedTemplate.systemContract.requiredVariables.includes(
                        variable
                      )
                  ) && (
                    <>
                      <div className="text-sm font-medium">
                        {t('optionalVariables')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.systemContract.availableVariables
                          .filter(
                            (variable) =>
                              !selectedTemplate.systemContract.requiredVariables.includes(
                                variable
                              )
                          )
                          .map((varName) => (
                            <Button
                              key={varName}
                              size="sm"
                              variant="outline"
                              onClick={() => insertVariable(varName)}
                              className="text-xs"
                              aria-label={t('insertOptionalVariable', {
                                variable: varName,
                              })}
                            >
                              <Code className="h-3 w-3 mr-1" />
                              {varName}
                            </Button>
                          ))}
                      </div>
                    </>
                  )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      {selectedTemplateId && !editorReady && isTemplateError && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-6">
            <p className="text-sm text-muted-foreground">
              {t('initialLoadFailed')}
            </p>
            <Button size="sm" onClick={() => refetchTemplate()}>
              {t('retry')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTemplateSelection(null)}
            >
              {t('cancel')}
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedTemplateId && editorReady && isTemplateError && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-6">
            <p className="text-sm text-muted-foreground">
              {t('refreshFailed')}
            </p>
            <Button size="sm" onClick={() => refetchTemplate()}>
              {t('retryRefresh')}
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedTemplateId && isTemplateFetching && !editorReady && (
        <p className="text-sm text-muted-foreground">{t('loadingTemplate')}</p>
      )}

      {selectedTemplate && editorReady && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Globe className="h-5 w-5" />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={selectedLocale === 'de' ? 'default' : 'outline'}
                    aria-pressed={selectedLocale === 'de'}
                    onClick={() => {
                      invalidatePreview();
                      setSelectedLocale('de');
                    }}
                  >
                    {t('locales.de')}
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedLocale === 'en' ? 'default' : 'outline'}
                    aria-pressed={selectedLocale === 'en'}
                    onClick={() => {
                      invalidatePreview();
                      setSelectedLocale('en');
                    }}
                  >
                    {t('locales.en')}
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedLocale === 'zh' ? 'default' : 'outline'}
                    aria-pressed={selectedLocale === 'zh'}
                    onClick={() => {
                      invalidatePreview();
                      setSelectedLocale('zh');
                    }}
                  >
                    {t('locales.zh')}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewMutation.isPending}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {previewMutation.isPending ? t('previewing') : t('preview')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? t('saving') : t('saveChanges')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">{t('subject')}</Label>
              <Input
                id="subject"
                value={getCurrentSubject()}
                onChange={(e) => setCurrentSubject(e.target.value)}
                placeholder={t('subjectPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="body">{t('body')}</Label>
              <Textarea
                id="body"
                value={getCurrentBody()}
                onChange={(e) => setCurrentBody(e.target.value)}
                placeholder={t('bodyPlaceholder')}
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {showPreview && previewResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t('previewTitle', { locale: selectedLocale.toUpperCase() })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t('subjectLabel')}
              </div>
              <div className="font-medium">{previewResult.subject}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {t('bodyLabel')}
              </div>
              <div className="bg-white dark:bg-gray-900 p-4 rounded border whitespace-pre-wrap">
                {previewResult.body}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
