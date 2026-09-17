import { PageHeaderSkeleton, TableSkeleton } from "@/components/finance/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[84px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-72" />
      <TableSkeleton rows={6} />
    </div>
  );
}
