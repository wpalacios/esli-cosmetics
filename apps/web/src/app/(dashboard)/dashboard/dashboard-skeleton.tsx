export function DashboardSkeleton() {
  return (
    <div className="space-y-6 duration-500 animate-in fade-in">
      {/* Stat Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="relative h-32 overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700"
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="flex h-full flex-col justify-between p-4">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
              <div className="h-8 w-16 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
              <div className="h-3 w-32 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map(i => (
          <div
            key={i}
            className="relative h-80 overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 p-6 dark:from-gray-800 dark:to-gray-700"
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <div
                  key={j}
                  className="h-8 animate-pulse rounded bg-gray-300 dark:bg-gray-600"
                  style={{
                    width: `${(j % 3) * 20 + 40}%`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="relative h-64 overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 p-6 dark:from-gray-800 dark:to-gray-700"
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="mb-4 h-6 w-28 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className="h-4 animate-pulse rounded bg-gray-300 dark:bg-gray-600"
                  style={{
                    width: `${(j % 2) * 15 + 60}%`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
