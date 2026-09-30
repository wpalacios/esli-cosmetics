/**
 * Text formatting utilities
 */

/**
 * Capitalize first letter of each word
 */
export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Convert to sentence case (first letter capitalized)
 */
export function toSentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert text to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Convert text to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, char) =>
    char ? char.toUpperCase() : ""
  );
}

/**
 * Convert text to PascalCase
 */
export function toPascalCase(str: string): string {
  const camelCase = toCamelCase(str);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Remove accents from text
 */
export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Format phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Format Nicaraguan phone number (+505 XXXX-XXXX)
  if (digits.length === 8) {
    return `+505 ${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // Format with country code
  if (digits.length === 11 && digits.startsWith("505")) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  // Return original if format is not recognized
  return phone;
}

/**
 * Mask sensitive information
 */
export function maskText(
  text: string,
  visibleStart = 2,
  visibleEnd = 2,
  maskChar = "*"
): string {
  if (text.length <= visibleStart + visibleEnd) {
    return text;
  }

  const start = text.slice(0, visibleStart);
  const end = text.slice(-visibleEnd);
  const middle = maskChar.repeat(text.length - visibleStart - visibleEnd);

  return start + middle + end;
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [username, domain] = email.split("@");
  if (!username || !domain) return email;

  const maskedUsername = maskText(username, 1, 1);
  return `${maskedUsername}@${domain}`;
}

/**
 * Extract initials from full name
 */
export function extractInitials(name: string, maxInitials = 2): string {
  return name
    .split(" ")
    .filter(word => word.length > 0)
    .slice(0, maxInitials)
    .map(word => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(
  text: string,
  searchTerms: string[],
  highlightClass = "highlight"
): string {
  let highlightedText = text;

  searchTerms.forEach(term => {
    if (term.trim()) {
      const regex = new RegExp(`(${term})`, "gi");
      highlightedText = highlightedText.replace(
        regex,
        `<mark class="${highlightClass}">$1</mark>`
      );
    }
  });

  return highlightedText;
}

/**
 * Generate readable ID from text
 */
export function generateId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}

/**
 * Estimate reading time
 */
export function estimateReadingTime(
  text: string,
  wordsPerMinute = 200
): number {
  const wordCount = countWords(text);
  return Math.ceil(wordCount / wordsPerMinute);
}
