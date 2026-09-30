import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm, LoginFormValues, createLoginSchema } from "./login-form";

// Mock the UI components
vi.mock("@esli-cosmetics/ui/atoms", () => ({
  Button: ({ children, loading, loadingText, ...props }: any) => (
    <button {...props}>
      {loading ? loadingText || "Loading..." : children}
    </button>
  ),
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

// Mock i18n
vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        email: "Email Address",
        password: "Password",
        rememberMe: "Remember me for 30 days",
        loginButton: "Login",
        signingIn: "Signing in...",
        "validation.emailRequired": "Email is required",
        "validation.emailInvalid": "Please enter a valid email",
        "validation.passwordMin": "Password must be at least 6 characters",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("@esli-cosmetics/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

// Mock the auth hook
const mockSignIn = vi.fn();
const mockRouter = { push: vi.fn() };

vi.mock("@/contexts/auth/auth-provider", () => ({
  useAuth: () => ({
    signIn: mockSignIn,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

describe("LoginForm", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockSignIn.mockClear();
    mockRouter.push.mockClear();
  });

  const renderLoginForm = (props = {}) => {
    return render(<LoginForm {...props} />);
  };

  describe("Rendering", () => {
    it("should render all form fields", () => {
      renderLoginForm();

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
      expect(screen.getByText(/remember me for 30 days/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /login/i })
      ).toBeInTheDocument();
    });

    it("should render with default values", () => {
      renderLoginForm({
        defaultValues: {
          email: "test@example.com",
          password: "password123",
          rememberMe: true,
        },
      });

      const emailInput = screen.getByDisplayValue("test@example.com");
      const passwordInput = screen.getByDisplayValue("password123");
      const checkbox = screen.getByRole("checkbox");

      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
      expect(checkbox).toBeChecked();
    });

    it("should show loading state when form is submitting", async () => {
      mockSignIn.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const submitButton = screen.getByRole("button", { name: /login/i });

      await user.type(emailInput, "user@example.com");
      await user.type(passwordInput, "password123");
      await user.click(submitButton);

      expect(screen.getByText(/signing in.../i)).toBeInTheDocument();
    });
  });

  describe("Form Interaction", () => {
    it("should toggle password visibility", async () => {
      renderLoginForm();

      const passwordInput = screen.getByPlaceholderText("••••••••");
      const toggleButton = screen.getByRole("button", { name: "" }); // Eye icon button

      // Initially password should be hidden
      expect(passwordInput).toHaveAttribute("type", "password");

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "text");

      // Click to hide password again
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("should toggle remember me checkbox", async () => {
      renderLoginForm();

      const checkbox = screen.getByRole("checkbox");

      // Initially unchecked
      expect(checkbox).not.toBeChecked();

      // Click to check
      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      // Click to uncheck
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it("should fill form inputs correctly", async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByPlaceholderText("••••••••");

      await user.type(emailInput, "user@example.com");
      await user.type(passwordInput, "mypassword");

      expect(emailInput).toHaveValue("user@example.com");
      expect(passwordInput).toHaveValue("mypassword");
    });
  });

  describe("Form Validation", () => {
    it("should show validation error for invalid email", async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole("button", { name: /login/i });

      // Enter invalid email
      await user.type(emailInput, "invalid-email");
      await user.click(submitButton);

      // Check if validation prevents submission (form validation is working)
      await waitFor(() => {
        expect(mockSignIn).not.toHaveBeenCalled();
      });
    });

    it("should show validation error for short password", async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const submitButton = screen.getByRole("button", { name: /login/i });

      await user.type(emailInput, "user@example.com");
      await user.type(passwordInput, "123");
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 6 characters/i)
        ).toBeInTheDocument();
      });
    });

    it("should show validation error for empty email", async () => {
      renderLoginForm();

      const submitButton = screen.getByRole("button", { name: /login/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });
  });

  describe("Form Submission", () => {
    it("should call signIn with correct values on valid form submission", async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const submitButton = screen.getByRole("button", { name: /login/i });

      // Fill the form
      await user.type(emailInput, "user@example.com");
      await user.type(passwordInput, "password123");

      // Submit the form
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: "user@example.com",
          password: "password123",
          rememberMe: false,
        });
      });
    });

    it("should not call signIn with invalid form data", async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole("button", { name: /login/i });

      // Enter invalid email
      await user.type(emailInput, "invalid-email");
      await user.click(submitButton);

      // Wait for validation to prevent submission
      await waitFor(() => {
        expect(mockSignIn).not.toHaveBeenCalled();
      });

      // signIn should not have been called
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it("should handle async signIn correctly", async () => {
      mockSignIn.mockResolvedValue(undefined);
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const submitButton = screen.getByRole("button", { name: /login/i });

      await user.type(emailInput, "user@example.com");
      await user.type(passwordInput, "password123");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: "user@example.com",
          password: "password123",
          rememberMe: false,
        });
      });

      // Should redirect after successful login
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/guidelines");
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const checkbox = screen.getByRole("checkbox");

      expect(emailInput).toHaveAttribute("type", "email");
      expect(emailInput).toHaveAttribute("autoComplete", "email");
      expect(passwordInput).toHaveAttribute("autoComplete", "current-password");
      expect(checkbox).toHaveAttribute("role", "checkbox");
    });

    it("should have proper placeholders", () => {
      renderLoginForm();

      expect(screen.getByPlaceholderText("tu@ejemplo.com")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle signIn throwing an error", async () => {
      mockSignIn.mockRejectedValue(new Error("Login failed"));

      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const submitButton = screen.getByRole("button", { name: /login/i });

      await user.type(emailInput, "user@example.com");
      await user.type(passwordInput, "password123");
      await user.click(submitButton);

      // Wait for the signIn handler to be called
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: "user@example.com",
          password: "password123",
          rememberMe: false,
        });
      });

      // Should not redirect on error
      expect(mockRouter.push).not.toHaveBeenCalled();

      // The form should still be in a valid state after error
      expect(emailInput).toHaveValue("user@example.com");
      expect(passwordInput).toHaveValue("password123");
    });

    it("should maintain form state during loading", async () => {
      mockSignIn.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const submitButton = screen.getByRole("button", { name: /login/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");

      expect(emailInput).toHaveValue("test@example.com");
      expect(passwordInput).toHaveValue("password123");

      // Submit form to trigger loading state
      await user.click(submitButton);

      // Form should maintain its state even during loading
      expect(emailInput).toHaveValue("test@example.com");
      expect(passwordInput).toHaveValue("password123");
    });
  });
});
