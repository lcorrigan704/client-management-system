import { Skeleton } from "@/components/ui/skeleton";

export default function ViewLoadingFallback() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-3xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
    </div>
  );
}

