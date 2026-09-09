import {
  MetricGridSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/finance/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <MetricGridSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
