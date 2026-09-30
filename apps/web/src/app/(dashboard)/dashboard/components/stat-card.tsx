import { Card } from "@esli-cosmetics/ui";
import { cn } from "@esli-cosmetics/utils";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number | null;
  variant?: "primary" | "secondary" | "success" | "warning" | "error";
};

const variantStyles = {
  primary:
    "bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border-primary-200/50",
  secondary:
    "bg-gradient-to-br from-secondary-50 to-secondary-100 dark:from-secondary-900/20 dark:to-secondary-800/20 border-secondary-200/50",
  success:
    "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200/50",
  warning:
    "bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200/50",
  error:
    "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200/50",
};

const iconVariantStyles = {
  primary: "text-primary-600 dark:text-primary-400",
  secondary: "text-secondary-600 dark:text-secondary-400",
  success: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-600 dark:text-red-400",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "primary",
}: StatCardProps) {
  const isPositive = trend !== null && trend !== undefined && trend >= 0;
  const showTrend = trend !== null && trend !== undefined;

  return (
    <Card
      variant="glass"
      padding="md"
      className={cn("relative overflow-hidden", variantStyles[variant])}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              {subtitle}
            </p>
          )}
          {showTrend && (
            <div
              className={cn(
                "mt-2 flex items-center gap-1 text-xs font-medium",
                isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {isPositive ? (
                <FaArrowUp className="h-3 w-3" />
              ) : (
                <FaArrowDown className="h-3 w-3" />
              )}
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={cn("rounded-xl p-3", iconVariantStyles[variant])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  );
}
