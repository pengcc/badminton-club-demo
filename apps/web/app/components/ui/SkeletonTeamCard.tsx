import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '@app/components/ui/card';

interface SkeletonTeamCardsProps {
  count?: number;
}

export function SkeletonTeamCards({ count = 3 }: SkeletonTeamCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-7 w-28 rounded bg-muted"></div>
              <div className="h-5 w-14 rounded bg-muted"></div>
            </div>
            <div className="h-4 w-36 rounded bg-muted"></div>
            <CardAction className="flex gap-1">
              <div className="h-8 w-8 rounded bg-muted/70"></div>
              <div className="h-8 w-8 rounded bg-muted/70"></div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted"></div>
              <div className="h-6 w-10 rounded bg-muted"></div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="h-4 w-20 rounded bg-muted"></div>
              <div className="h-4 w-24 rounded bg-muted"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
