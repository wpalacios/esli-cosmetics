import { zodResolver as _zodResolver } from "@hookform/resolvers/zod";

/**
 * Re-export of zodResolver that works with exactOptionalPropertyTypes.
 * The upstream @hookform/resolvers types reference Zod v4's $ZodTypeInternals
 * which is incompatible with Zod v3 schemas under this strict flag.
 */
export const zodResolver: any = _zodResolver; // bypass Zod v3/v4 type mismatch
