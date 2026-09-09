import {
  MetricGridSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/finance/skeletons";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <MetricGridSkeleton count={6} />
      <TableSkeleton rows={5} />
      <TableSkeleton rows={4} />
    </div>
  );
}
