export function requireAdmin(headers: Headers): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false; // if configured, require it
  const auth = headers.get('authorization') || headers.get('Authorization');
  if (!auth) return false;
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === token) return true;
  return false;
}

export function isAdminConfigured(): boolean {
  return !!process.env.ADMIN_TOKEN;
}

