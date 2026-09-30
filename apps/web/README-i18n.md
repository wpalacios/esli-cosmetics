# Multi-Language Support (i18n) Implementation

This document outlines the multi-language support implementation for the Esli Cosmetics web application.

## Overview

The application now supports both Spanish and English with Spanish as the default language. The implementation uses i18next with React integration and works with both Server Side Rendering (SSR) and Client Side Rendering (CSR).

## Libraries Used

- `i18next`: ^25.5.2 - Core internationalization library
- `react-i18next`: ^16.0.0 - React integration for i18next
- `i18next-browser-languagedetector`: ^8.2.0 - Automatic language detection in browser
- `i18next-resources-to-backend`: ^1.2.1 - Dynamic translation loading

## Project Structure

```
src/
├── lib/i18n/
│   ├── settings.ts          # i18n configuration settings
│   ├── index.ts            # Server-side translation functions
│   ├── client.ts           # Client-side translation functions
│   └── locales/
│       ├── es/             # Spanish translations
│       │   ├── common.json
│       │   ├── login.json
│       │   └── guidelines.json
│       └── en/             # English translations
│           ├── common.json
│           ├── login.json
│           └── guidelines.json
└── contexts/i18n/
    └── i18n-provider.tsx   # React context provider for i18n
```

## Configuration

### Default Settings
- **Fallback Language**: Spanish (`es`)
- **Supported Languages**: Spanish (`es`), English (`en`)
- **Default Namespace**: `common`
- **Cookie Name**: `i18next` (for language preference persistence)

### Browser Detection
The application automatically detects user language preference from:
1. Cookie storage
2. Local storage
3. Browser navigator language

## Usage

### Server-Side Components (SSR)
```tsx
import { useTranslation } from "@/lib/i18n";

export default async function MyPage() {
  const { t } = await useTranslation("es", "login");
  
  return (
    <div>
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>
    </div>
  );
}
```

### Client-Side Components (CSR)
```tsx
"use client";
import { useTranslation } from "@/lib/i18n/client";

export function MyClientComponent() {
  const { t } = useTranslation("es", "common");
  
  return (
    <div>
      <button>{t("save")}</button>
      <button>{t("cancel")}</button>
    </div>
  );
}
```

## Implemented Pages

### 1. Login Page (`/login`)
- **Server-side**: Main page layout and static content
- **Client-side**: Interactive login form
- **Translations**: 
  - Welcome messages
  - Form labels and placeholders
  - Validation messages
  - Button texts

### 2. Guidelines Page (`/guidelines`)
- **Client-side**: Interactive component showcase
- **Translations**: 
  - Page title and subtitle
  - Component descriptions

## Translation Files

### Common Translations (`common.json`)
Shared translations used across multiple components:
```json
{
  "welcome": "Bienvenido",
  "login": "Iniciar Sesión",
  "email": "Correo Electrónico",
  "password": "Contraseña",
  "loading": "Cargando...",
  "save": "Guardar",
  "cancel": "Cancelar"
}
```

### Login-Specific (`login.json`)
Login page specific translations including validation messages:
```json
{
  "title": "Iniciar Sesión",
  "subtitle": "Bienvenido de nuevo...",
  "validation": {
    "emailRequired": "El correo es obligatorio",
    "passwordMin": "La contraseña debe tener al menos 6 caracteres"
  }
}
```

## Features Implemented

1. **Form Validation**: Translation-aware validation messages using Zod schema factory
2. **Dynamic Placeholders**: Language-appropriate input placeholders
3. **Loading States**: Translated loading and button states
4. **Remember Me**: Translated checkbox labels
5. **Page Titles**: Translated page headers and descriptions

## Technical Implementation Details

### Schema Factory Pattern
For forms with validation, a schema factory pattern is used to create language-aware validation schemas:

```tsx
const createLoginSchema = (t: (key: string) => string) => z.object({
  email: z.string().min(1, t("validation.emailRequired")),
  password: z.string().min(6, t("validation.passwordMin")),
});
```

### Provider Integration
The i18n provider is integrated at the root level in `providers.tsx`:
```tsx
<I18nProvider lng="es">
  <ThemeProvider>
    <AuthProvider>
      {children}
    </AuthProvider>
  </ThemeProvider>
</I18nProvider>
```

## Testing

All existing unit tests have been updated to work with the i18n implementation:
- Mock translation functions for consistent test behavior
- Updated placeholder text expectations
- Maintained full test coverage (16/16 tests passing)

## Future Enhancements

1. **Language Switcher**: Add UI component for language selection
2. **Additional Languages**: Extend support for more languages
3. **RTL Support**: Right-to-left language support
4. **Pluralization**: Advanced plural form handling
5. **Dynamic Loading**: Lazy load translation files by route

## Migration Notes

- Form validation messages are now language-aware
- Email placeholder changed from `you@example.com` to `tu@ejemplo.com` for Spanish
- All user-facing text should use translation keys instead of hardcoded strings
- Components requiring translations should import the appropriate `useTranslation` hook

## Performance Considerations

- Translations are loaded dynamically using `resourcesToBackend`
- Only required namespaces are loaded per component
- Language preference is persisted in cookies for consistent UX
- Server-side translations avoid hydration mismatches
