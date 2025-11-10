'use client';

import { useTranslations } from 'next-intl';
import { withAuth, useAuth } from '@app/hooks/useAuth';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@app/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { FormField } from '@app/components/FormField';
import { Key, User, Mail, CheckCircle2 } from 'lucide-react';
import { AuthService } from '@app/services/authService';

function AccountClient() {
  const t = useTranslations('common');
  const tAccount = useTranslations('account');
  const { user, logout } = useAuth();
  const { lang } = useParams();
  const changePasswordMutation = AuthService.useChangePassword();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<{[key: string]: string[]}>({});

  const handleLogout = () => {
    logout();
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: [] }));
    }
  };

  const validatePasswordForm = () => {
    const errors: {[key: string]: string[]} = {};

    if (!passwordData.currentPassword) {
      errors.currentPassword = ['Current password is required'];
    }
    if (!passwordData.newPassword) {
      errors.newPassword = ['New password is required'];
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = ['Password must be at least 8 characters long'];
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = ['Passwords do not match'];
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
        newPassword: passwordData.newPassword
      });

      // Success - show temporary success message
      alert(tAccount('passwordChangeSuccess') || 'Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowChangePassword(false);
      setPasswordErrors({});
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to change password';
      setPasswordErrors({ general: [errorMessage] });
    }
  };

  if (!user) {
    return null; // This should not happen due to withAuth wrapper
  }

  return (
    <div className="min-h-screen bg-background">
      <Header withMainNav={false} lang={lang as string} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{tAccount('title')}</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{tAccount('fullName')}</label>
                  <p className="text-sm font-medium">{user.fullName || `${user.lastName}, ${user.firstName}`}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('email')}</label>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{tAccount('role')}</label>
                  <p className="text-sm font-medium capitalize">{user.role}</p>
                </div>
                {user.membershipType && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{tAccount('membershipType')}</label>
                    <p className="text-sm font-medium capitalize">{user.membershipType}</p>
                  </div>
                )}
                {user.membershipStatus && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{tAccount('membershipStatus')}</label>
                    <p className={`text-sm font-medium capitalize ${
                      user.membershipStatus === 'active' ? 'text-green-600' :
                      user.membershipStatus === 'inactive' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {user.membershipStatus}
                    </p>
                  </div>
                )}
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
                  <FormField
                    label={tAccount('currentPassword')}
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(value) => handlePasswordChange('currentPassword', value)}
                    error={passwordErrors.currentPassword}
                    required
                  />
                  <FormField
                    label={tAccount('newPassword')}
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(value) => handlePasswordChange('newPassword', value)}
                    error={passwordErrors.newPassword}
                    required
                  />
                  <FormField
                    label={tAccount('confirmPassword')}
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(value) => handlePasswordChange('confirmPassword', value)}
                    error={passwordErrors.confirmPassword}
                    required
                  />

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
                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordErrors({});
                      }}
                      className="flex-1"
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="flex-1"
                    >
                      {changePasswordMutation.isPending ? tAccount('updating') : tAccount('updatePassword')}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
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
              <Button
                onClick={handleLogout}
                variant="destructive"
              >
                {t('logout')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(AccountClient);