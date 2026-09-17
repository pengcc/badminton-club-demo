'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { useId, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@app/components/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { FormField } from '@app/components/FormField';
import { Eye, EyeOff, Key, Mail, Users } from 'lucide-react';
import { Input } from '@app/components/ui/input';
import { FormLabel } from '@app/components/FormLabel';
import { AuthService } from '@app/services/authService';
import {
  AccountKind,
  Capability,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import { emailChangeRequestSchema } from '@club/shared-types/schemas/user';
import { hasCapability } from '@app/lib/access/permissions';
import { UserService } from '@app/services/userService';
import { MembershipTerminationCard } from './MembershipTerminationCard';
import { navigateToDocument } from '@app/lib/navigation/documentNavigation';
import { PersonProfileCard } from './PersonProfileCard';

const supportedLocales = ['de', 'en', 'zh'] as const;

function isSupportedLocale(
  value: unknown
): value is (typeof supportedLocales)[number] {
  return (
    typeof value === 'string' &&
    supportedLocales.includes(value as (typeof supportedLocales)[number])
  );
}

function AccountClient() {
  const t = useTranslations('common');
  const tAccount = useTranslations('account');
  const { user, logout, retrySession, sessionRefreshFailed } = useAuth();
  const { lang } = useParams();
  const changePasswordMutation = AuthService.useChangePassword();
  const requestEmailChangeMutation = UserService.useRequestEmailChange();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const passwordFieldId = useId();
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<{
    [key: string]: string[];
  }>({});

  // Email change state
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const handleLogout = () => {
    logout();
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (passwordErrors[field]) {
      setPasswordErrors((prev) => ({ ...prev, [field]: [] }));
    }
  };

  const validatePasswordForm = () => {
    const errors: { [key: string]: string[] } = {};

    if (!passwordData.currentPassword) {
      errors.currentPassword = [tAccount('passwordValidation.currentRequired')];
    }
    if (!passwordData.newPassword) {
      errors.newPassword = [tAccount('passwordValidation.newRequired')];
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = [tAccount('passwordValidation.minimumLength')];
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = [tAccount('passwordValidation.mismatch')];
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswordForm()) {
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      navigateToDocument(`/${isSupportedLocale(lang) ? lang : 'de'}/login`);
    } catch {
      setPasswordErrors({ general: [tAccount('passwordChangeError')] });
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    if (!newEmail) {
      setEmailError(tAccount('emailChange.required'));
      return;
    }

    const locale = isSupportedLocale(lang) ? lang : 'de';
    const parsedRequest = emailChangeRequestSchema.safeParse({
      newEmail,
      locale,
    });
    if (!parsedRequest.success) {
      setEmailError(tAccount('emailChange.invalid'));
      return;
    }
    if (!user) return; // Should not happen

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      setEmailError(tAccount('emailChange.mustDiffer'));
      return;
    }

    try {
      await requestEmailChangeMutation.mutateAsync(parsedRequest.data);

      setEmailSuccess(tAccount('emailChange.sent', { email: newEmail }));
      setNewEmail('');
      setShowChangeEmail(false);
    } catch {
      setEmailError(tAccount('emailChange.requestFailed'));
    }
  };

  const handleCancelEmailChange = () => {
    setShowChangeEmail(false);
    setNewEmail('');
    setEmailError('');
    setEmailSuccess('');
  };

  const canRequestTermination =
    user.membershipStatus === MembershipStatus.ACTIVE ||
    user.membershipStatus === MembershipStatus.PASSIVE;
  const canReviewTermination = canRequestTermination;

  return (
    <div className="min-h-screen bg-background">
      <Header intent="product" lang={lang as string} />

      {sessionRefreshFailed && (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <span>{tAccount('sessionRefreshFailed')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void retrySession()}
            >
              {tAccount('retrySession')}
            </Button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{tAccount('title')}</h1>
          <p className="text-muted-foreground">{tAccount('description')}</p>
        </div>

        {user.accountKind === AccountKind.PERSON && (
          <div className="mb-6">
            <PersonProfileCard userId={user.id} onNameSaved={retrySession} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Account identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {tAccount('accountSecurity')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('email')}
                  </label>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{user.email}</p>
                    {user.accountKind === AccountKind.PERSON &&
                      !showChangeEmail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowChangeEmail(true)}
                          className="text-xs"
                        >
                          {tAccount('emailChange.action')}
                        </Button>
                      )}
                  </div>

                  {user.accountKind === AccountKind.SUPER_ADMIN && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tAccount('emailChange.operatorManaged')}
                    </p>
                  )}

                  {/* Email Change Form */}
                  {user.accountKind === AccountKind.PERSON &&
                    showChangeEmail && (
                      <div className="mt-3 p-4 border rounded-md bg-muted/50">
                        <form
                          onSubmit={handleEmailSubmit}
                          className="space-y-3"
                        >
                          <FormField
                            label={tAccount('emailChange.newEmail')}
                            type="email"
                            value={newEmail}
                            onChange={setNewEmail}
                            error={emailError ? [emailError] : undefined}
                            placeholder={tAccount('emailChange.placeholder')}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={requestEmailChangeMutation.isPending}
                            >
                              {requestEmailChangeMutation.isPending
                                ? tAccount('emailChange.sending')
                                : tAccount('emailChange.send')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEmailChange}
                              disabled={requestEmailChangeMutation.isPending}
                            >
                              {tAccount('emailChange.cancel')}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                  {/* Success Message */}
                  {emailSuccess && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">{emailSuccess}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {tAccount('securitySettings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showChangePassword ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    {tAccount('securityDescription')}
                  </p>
                  <Button
                    onClick={() => setShowChangePassword(true)}
                    className="w-full"
                  >
                    <Key className="mr-2 h-4 w-4" />
                    {tAccount('changePassword')}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {(
                    [
                      'currentPassword',
                      'newPassword',
                      'confirmPassword',
                    ] as const
                  ).map((field) => {
                    const id = `${passwordFieldId}-${field}`;
                    const error = passwordErrors[field]?.[0];
                    const visible = visiblePasswords[field];
                    return (
                      <div key={field} className="space-y-2 form-field">
                        <FormLabel htmlFor={id} required>
                          {tAccount(field)}
                        </FormLabel>
                        <div className="relative">
                          <Input
                            id={id}
                            name={field}
                            type={visible ? 'text' : 'password'}
                            value={passwordData[field]}
                            onChange={(event) =>
                              handlePasswordChange(field, event.target.value)
                            }
                            className="pr-12"
                            aria-invalid={!!error}
                            aria-describedby={error ? `${id}-error` : undefined}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-lg"
                            className="absolute right-0 top-0 text-muted-foreground"
                            aria-label={tAccount(
                              visible ? 'hidePassword' : 'showPassword',
                              { field: tAccount(field) }
                            )}
                            aria-controls={id}
                            onClick={() =>
                              setVisiblePasswords((previous) => ({
                                ...previous,
                                [field]: !previous[field],
                              }))
                            }
                          >
                            {visible ? (
                              <EyeOff aria-hidden="true" />
                            ) : (
                              <Eye aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                        {error && (
                          <p
                            className="text-sm text-destructive mt-1"
                            id={`${id}-error`}
                          >
                            {error}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {passwordErrors.general && (
                    <div className="text-sm text-red-600">
                      {passwordErrors.general[0]}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowChangePassword(false);
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        });
                        setPasswordErrors({});
                        setVisiblePasswords({
                          currentPassword: false,
                          newPassword: false,
                          confirmPassword: false,
                        });
                      }}
                      className="flex-1"
                    >
                      {tAccount('cancel')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="flex-1"
                    >
                      {changePasswordMutation.isPending
                        ? tAccount('updating')
                        : tAccount('updatePassword')}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {user.accountKind === AccountKind.PERSON &&
            hasCapability(user, Capability.CURRENT_MEMBER) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {tAccount('membership')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {user.membershipType && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {tAccount('membershipType')}
                      </p>
                      <p className="text-sm font-medium">
                        {tAccount(
                          `membershipTypeValues.${user.membershipType}`
                        )}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {tAccount('membershipStatus')}
                    </p>
                    <p className="text-sm font-medium">
                      {tAccount(
                        `membershipStatusValues.${user.membershipStatus}`
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          {hasCapability(user, Capability.MEMBERSHIP_SELF_SERVICE) &&
            canReviewTermination && (
              <MembershipTerminationCard canRequest={canRequestTermination} />
            )}
        </div>

        {/* Logout Section */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{tAccount('signOut')}</h3>
                <p className="text-sm text-muted-foreground">
                  {tAccount('signOutDescription')}
                </p>
              </div>
              <Button onClick={handleLogout} variant="destructive">
                {t('logout')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AccountClient;
