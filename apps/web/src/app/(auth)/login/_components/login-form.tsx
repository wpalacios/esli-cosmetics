"use client";

import { zodResolver } from "@/lib/zod-resolver";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import {
  AiOutlineCheck,
  AiOutlineEye,
  AiOutlineEyeInvisible,
  AiOutlineLoading3Quarters,
} from "react-icons/ai";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import * as z from "zod";

import { useTranslation } from "react-i18next";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@esli-cosmetics/ui/atoms";
import { cn } from "@esli-cosmetics/utils";

// Create schema factory to use translations
const createLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: z
      .string()
      .min(1, t("validation.emailRequired"))
      .email(t("validation.emailInvalid")),
    password: z.string().min(6, t("validation.passwordMin")),
    rememberMe: z.boolean().default(false),
  });

// Create a type based on the schema structure
export type LoginFormValues = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export interface LoginFormProps {
  defaultValues?: Partial<LoginFormValues>;
}

export function LoginForm({
  defaultValues = {
    email: "",
    password: "",
    rememberMe: false,
  },
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation("login");

  const loginSchema = createLoginSchema(t);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues,
  });

  const handleSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      // Call API route directly from client to ensure cookies are set in browser
      // Server actions can't set response cookies, so we use API route instead
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email, password: data.password }),
        credentials: "include", // Important: include cookies
      });

      if (!response.ok) {
        // Parse error response with code for better error handling
        const errorData = await response.json().catch(() => ({
          error: "Invalid credentials",
          code: "UNKNOWN_ERROR",
        }));

        // Get error code from response, default to UNKNOWN_ERROR
        const errorCode = errorData.code || "UNKNOWN_ERROR";

        // Get translated error message based on error code
        const errorKey = `errors.${errorCode}`;
        const translatedError = t(errorKey);

        // If translation key doesn't exist, fall back to default or error message
        const errorMessage =
          translatedError === errorKey
            ? errorData.error || t("errors.default")
            : translatedError;

        setError(errorMessage);
        return;
      }

      const result = await response.json();

      if (result?.success) {
        // Invalidate and refetch auth session query to get updated user data
        await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
        await queryClient.refetchQueries({ queryKey: ["auth-session"] });

        // Wait a bit for the query to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Fetch user data to check role
        try {
          const userResponse = await fetch("/api/auth/me");
          if (userResponse.ok) {
            const userData = await userResponse.json();
            const userRoles = userData.roles || [];

            // Extract role keys as a Set for efficient membership checks
            const roleKeys = new Set(
              userRoles.map((role: any) => role.key || role)
            );

            // Redirect based on role priority (admin > store_manager > inventory_manager > sales_rep > cashier)
            if (roleKeys.has("admin")) {
              router.push("/sales/quotes");
            } else if (roleKeys.has("store_manager")) {
              router.push("/sales/orders");
            } else if (roleKeys.has("inventory_manager")) {
              router.push("/stock/stock-levels");
            } else if (roleKeys.has("sales_rep")) {
              router.push("/sales/quotes");
            } else if (roleKeys.has("cashier")) {
              router.push("/sales/pos");
            } else {
              // Fallback to dashboard (will redirect if not admin)
              router.push("/sales/quotes");
            }
          } else {
            // Fallback to dashboard if user data fetch fails
            router.push("/sales/quotes");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Fallback to dashboard
          router.push("/sales/quotes");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="border-error-200 animate-slide-down rounded-2xl border bg-gradient-to-r from-error-50 to-error-100 p-4 dark:border-error-800 dark:from-error-900/30 dark:to-error-800/30">
          <div className="dark:text-error-400 text-sm font-medium text-error-700">
            {error}
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <div className="group relative">
                  <FormControl>
                    <input
                      type="email"
                      placeholder=" "
                      autoComplete="email"
                      className={cn(
                        "peer w-full rounded-xl border-2 px-4 py-3.5 pt-6 transition-all duration-300",
                        "bg-white/50 backdrop-blur-sm dark:bg-gray-800/50",
                        "border-neutral-200 focus:border-primary-400 dark:border-neutral-700 dark:focus:border-primary-500",
                        "text-neutral-800 placeholder-transparent dark:text-white",
                        "focus:outline-none focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-900",
                        "hover:border-primary-300 hover:bg-white/70 dark:hover:bg-gray-800/70"
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormLabel
                    className={cn(
                      "pointer-events-none absolute left-4 transition-all duration-300",
                      "text-neutral-500 dark:text-neutral-400",
                      "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base",
                      "peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary-600 dark:peer-focus:text-primary-400",
                      "top-2 text-xs"
                    )}
                  >
                    {t("email")}
                  </FormLabel>
                  <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-primary-200 to-secondary-200 opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-20" />
                </div>
                <FormMessage className="ml-1 text-xs" />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="group relative">
                  <FormControl>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder=" "
                      autoComplete="current-password"
                      className={cn(
                        "peer w-full rounded-xl border-2 px-4 py-3.5 pr-12 pt-6 transition-all duration-300",
                        "bg-white/50 backdrop-blur-sm dark:bg-gray-800/50",
                        "border-neutral-200 focus:border-primary-400 dark:border-neutral-700 dark:focus:border-primary-500",
                        "text-neutral-800 placeholder-transparent dark:text-white",
                        "focus:outline-none focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-900",
                        "hover:border-primary-300 hover:bg-white/70 dark:hover:bg-gray-800/70"
                      )}
                      {...field}
                    />
                  </FormControl>
                  <FormLabel
                    className={cn(
                      "pointer-events-none absolute left-4 transition-all duration-300",
                      "text-neutral-500 dark:text-neutral-400",
                      "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base",
                      "peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary-600 dark:peer-focus:text-primary-400",
                      "top-2 text-xs"
                    )}
                  >
                    {t("password")}
                  </FormLabel>
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-neutral-400 transition-colors duration-200 hover:bg-primary-50 hover:text-primary-500 dark:text-neutral-500 dark:hover:bg-primary-900/30 dark:hover:text-primary-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <AiOutlineEyeInvisible className="h-5 w-5" />
                    ) : (
                      <AiOutlineEye className="h-5 w-5" />
                    )}
                  </button>
                  <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-primary-200 to-secondary-200 opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-20" />
                </div>
                <FormMessage className="ml-1 text-xs" />
              </FormItem>
            )}
          />

          {/* Remember Me Checkbox */}
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <CheckboxPrimitive.Root
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={cn(
                      "peer h-5 w-5 shrink-0 rounded-md border-2 transition-all duration-200",
                      "border-neutral-300 hover:border-primary-400 dark:border-neutral-600 dark:hover:border-primary-500",
                      "ring-offset-background focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-primary-500 data-[state=checked]:to-primary-600",
                      "data-[state=checked]:border-primary-500 data-[state=checked]:text-white"
                    )}
                  >
                    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
                      <AiOutlineCheck className="h-4 w-4" />
                    </CheckboxPrimitive.Indicator>
                  </CheckboxPrimitive.Root>
                </FormControl>
                <FormLabel className="cursor-pointer text-sm font-normal text-neutral-600 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200">
                  {t("rememberMe")}
                </FormLabel>
              </FormItem>
            )}
          />

          {/* Login Button */}
          <Button
            type="submit"
            className={cn(
              "w-full rounded-xl py-3.5 text-base font-semibold transition-all duration-300",
              "bg-gradient-to-r from-primary-500 to-primary-600 text-white",
              "hover:from-primary-600 hover:to-primary-700",
              "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-300/50",
              "active:translate-y-0",
              "focus:outline-none focus:ring-4 focus:ring-primary-200",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            )}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <AiOutlineLoading3Quarters className="h-5 w-5 animate-spin" />
                {t("signingIn")}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {t("loginButton")}
                <svg
                  className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </span>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

// Export the schema factory for testing purposes
export { createLoginSchema };
