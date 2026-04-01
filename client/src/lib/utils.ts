import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_BASE } from "./queryClient"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Resolve a relative API path (e.g. "/api/uploads/photo.jpg") to the full
 * backend URL when running in hybrid mode. In same-origin mode this is a no-op.
 */
export function resolveApiUrl(path: string): string {
  if (!path || !API_BASE) return path;
  // Already absolute — leave it alone
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}
