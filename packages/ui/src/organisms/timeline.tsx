import { forwardRef } from "react";
import { cn } from "@esli-cosmetics/utils";
import { Badge } from "../atoms/badge";

export type TimelineItem = {
  id: string;
  title?: string;
  description?: string;
  timestamp: string | Date;
  user?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  };
  badges?: Array<{
    label: string;
    variant?:
      | "primary"
      | "secondary"
      | "success"
      | "warning"
      | "error"
      | "outline"
      | "neutral";
  }>;
  metadata?: React.ReactNode;
};

export type TimelineProps = {
  items: TimelineItem[];
  dotColor?: string;
  showUser?: boolean;
  formatTimestamp?: (timestamp: string | Date) => string;
  emptyMessage?: string;
} & React.HTMLAttributes<HTMLDivElement>;

const Timeline = forwardRef<HTMLDivElement, TimelineProps>(
  (
    {
      items,
      dotColor = "#ff48b0",
      showUser = true,
      formatTimestamp,
      emptyMessage = "No activity to display",
      className,
      ...props
    },
    ref
  ) => {
    if (!items || items.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "text-center py-8 text-gray-500 dark:text-gray-400",
            className
          )}
          {...props}
        >
          {emptyMessage}
        </div>
      );
    }

    const defaultFormatTimestamp = (timestamp: string | Date) => {
      const date =
        typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      return date.toLocaleString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const formatTime = formatTimestamp ?? defaultFormatTimestamp;

    const getUserDisplayName = (user?: TimelineItem["user"]) => {
      if (!user) return "Unknown";
      return (
        user.email ??
        user.name ??
        `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ??
        "Unknown"
      );
    };

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        {/* Timeline line - hidden on mobile, visible on larger screens */}
        <div className="hidden sm:block absolute left-3 sm:left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

        <div className="space-y-4 sm:space-y-6">
          {items.map(item => (
            <div key={item.id} className="relative flex gap-3 sm:gap-4">
              {/* Timeline dot - responsive sizing */}
              <div className="relative z-10 flex-shrink-0">
                <div
                  className="h-6 w-6 sm:h-8 sm:w-8 rounded-full border-2 sm:border-4 border-white dark:border-gray-800 flex items-center justify-center"
                  style={{ backgroundColor: dotColor }}
                >
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-white"></div>
                </div>
              </div>

              {/* Log content - responsive padding and layout */}
              <div className="flex-1 min-w-0 pb-4 sm:pb-6">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
                  {/* Header section - responsive flex direction */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      {item.title && (
                        <div className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white mb-1">
                          {item.title}
                        </div>
                      )}

                      {/* Badges - responsive wrapping */}
                      {item.badges && item.badges.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                          {item.badges.map((badge, badgeIndex) => (
                            <Badge
                              key={badgeIndex}
                              variant={badge.variant ?? "secondary"}
                              className="text-xs"
                            >
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      {item.description && (
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-1 sm:mt-2 break-words">
                          {item.description}
                        </p>
                      )}

                      {/* Metadata */}
                      {item.metadata && (
                        <div className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {item.metadata}
                        </div>
                      )}
                    </div>

                    {/* Timestamp - responsive positioning */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatTime(item.timestamp)}
                    </div>
                  </div>

                  {/* User info - responsive text size */}
                  {showUser && item.user && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {getUserDisplayName(item.user)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

Timeline.displayName = "Timeline";

export { Timeline };
