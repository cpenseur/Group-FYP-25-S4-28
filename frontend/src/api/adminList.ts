// src/auth/admin.ts
export const ADMIN_EMAILS = new Set([
  "pyhbwong001@mymail.sim.edu.sg",
  "kwee003@mymail.sim.edu.sg",
  // add your admin emails here
]);

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}