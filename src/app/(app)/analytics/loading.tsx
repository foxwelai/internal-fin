import {
  ChartSkeleton,
  MetricGridSkeleton,
  PageHeaderSkeleton,
} from "@/components/finance/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <Skeleton className="h-10 w-72" />
      <MetricGridSkeleton />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <ChartSkeleton key={index} height={240} />
        ))}
      </div>
    </div>
  );
}
