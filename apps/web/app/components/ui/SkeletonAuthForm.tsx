import { Card, CardContent, CardHeader } from '@app/components/ui/card';
import { Skeleton } from '@app/components/ui/skeleton';

/**
 * Skeleton loading state for authentication forms
 * Used during initial auth state check or login submission
 */
export function SkeletonAuthForm() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <Skeleton className="h-8 w-32" /> {/* Title skeleton */}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email field skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" /> {/* Label */}
          <Skeleton className="h-10 w-full" /> {/* Input */}
        </div>

        {/* Password field skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" /> {/* Label */}
          <Skeleton className="h-10 w-full" /> {/* Input */}
        </div>

        {/* Submit button skeleton */}
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
