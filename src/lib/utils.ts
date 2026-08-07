import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind/clsx class lists into a single string.
 *
 * Accepts the same input shape as `clsx` and then applies `twMerge`
 * to collapse Tailwind utility duplicates.
 *
 * @param inputs - class value(s) accepted by clsx
 * @returns merged className string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}