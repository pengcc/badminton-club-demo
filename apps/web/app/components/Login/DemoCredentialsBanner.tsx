'use client';

export const DemoCredentialsBanner = () => {
  const show = process.env.NEXT_PUBLIC_SHOW_DEMO_HINTS === 'true';

  if (!show) return null;

  return (
    <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3 text-sm text-yellow-900 dark:text-yellow-100 shadow-sm">
      <p className="font-semibold mb-1.5">Demo Credentials</p>
      <div className="space-y-1">
        <p className="text-xs">
          <span className="font-medium">Admin:</span> <code className="bg-yellow-100 dark:bg-yellow-800 px-1 py-0.5 rounded">admin@club.dev</code> / <code className="bg-yellow-100 dark:bg-yellow-800 px-1 py-0.5 rounded">admin123</code>
        </p>
        <p className="text-xs">
          <span className="font-medium">Member:</span> <code className="bg-yellow-100 dark:bg-yellow-800 px-1 py-0.5 rounded">lisa.schmidt53@club.dev</code> / <code className="bg-yellow-100 dark:bg-yellow-800 px-1 py-0.5 rounded">member123</code>
        </p>
      </div>
      <p className="mt-2 text-xs text-yellow-800 dark:text-yellow-300">
        Registrations may be disabled to protect the demo database.
      </p>
    </div>
  );
};
