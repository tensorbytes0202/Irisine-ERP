/**
 * Who owns the whole platform: an IT_ADMIN account whose email is listed in the server setting
 * PLATFORM_OWNER_EMAILS (comma separated). The role alone is not enough, because school admins
 * could create IT_ADMIN accounts in earlier versions. With the setting empty nobody is the owner.
 */
export function isPlatformOwner(user: { role: string; email: string }, ownerEmails?: string): boolean {
  if (user.role !== 'IT_ADMIN' || !user.email) return false;
  return (ownerEmails ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(user.email.toLowerCase());
}
