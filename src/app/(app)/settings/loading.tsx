import { PageHeaderSkeleton } from "@/components/finance/skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeaderSkeleton />
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="space-y-4 p-5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-80 max-w-full" />
          <Skeleton className="h-9 w-full max-w-sm" />
        </Card>
      ))}
    </div>
  );
}
