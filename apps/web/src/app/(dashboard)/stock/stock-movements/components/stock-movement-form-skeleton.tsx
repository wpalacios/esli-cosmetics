const SkeletonBlock = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
  />
);

const SkeletonInput = () => (
  <div className="space-y-2">
    <SkeletonBlock className="h-4 w-24" />
    <SkeletonBlock className="h-11 w-full" />
  </div>
);

export function StockMovementFormSkeleton() {
  return (
    <div className="space-y-6 duration-300 animate-in fade-in">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-6">
          <SkeletonInput />
          <SkeletonInput />
          <SkeletonInput />
          <SkeletonInput />
        </div>
        <div className="space-y-6">
          <SkeletonInput />
          <SkeletonInput />
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-24 w-full" />
          </div>
        </div>
      </div>
      <div className="flex justify-end space-x-4 pt-6">
        <SkeletonBlock className="h-11 w-24" />
        <SkeletonBlock className="h-11 w-24" />
      </div>
    </div>
  );
}
