import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';

export function createAuth(database, { origin, secret }) {
  if (!secret || secret.length < 32) throw new Error('Configure BETTER_AUTH_SECRET before enabling sign-in.');
  return betterAuth({
    appName: 'EasyFarm', baseURL: origin, secret, database,
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    user: { additionalFields: {
      role: { type: ['buyer', 'grower'], required: true, input: true },
      organization: { type: 'string', required: true, input: true },
      location: { type: 'string', required: false, input: true }
    } },
    databaseHooks: { user: {
      create: { before: async user => {
        if (!['buyer', 'grower'].includes(user.role)) throw new APIError('BAD_REQUEST', { message: 'Choose a buyer or grower account.' });
        if (!user.organization?.trim() || user.organization.length > 100 || !user.name?.trim() || user.name.length > 100 || (user.location?.length || 0) > 100) throw new APIError('BAD_REQUEST', { message: 'Enter your name and farm or business name (maximum 100 characters).' });
        return { data: { ...user, name: user.name.trim(), organization: user.organization.trim(), location: user.location?.trim() || '' } };
      } },
      update: { before: async user => {
        if ('role' in user) throw new APIError('FORBIDDEN', { message: 'An account’s portal cannot be changed. Sign in to the appropriate account.' });
        return { data: user };
      } }
    } },
    rateLimit: { enabled: true, window: 60, max: 30, storage: 'database' },
    advanced: { cookiePrefix: 'easyfarm', ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] }, database: { generateId: 'uuid' } }
  });
}
