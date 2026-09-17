import {
  ChartSkeleton,
  MetricGridSkeleton,
  PageHeaderSkeleton,
} from "@/components/finance/skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="space-y-4 p-5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </Card>
        ))}
      </div>
      <MetricGridSkeleton count={8} />
      <div className="grid gap-3 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ChartSkeleton />
        </div>
        <div className="xl:col-span-2">
          <ChartSkeleton height={188} />
        </div>
      </div>
    </div>
  );
}
