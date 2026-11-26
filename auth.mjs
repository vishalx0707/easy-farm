import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';

export function createAuth(database, { origin, secret, googleClientId, googleClientSecret }) {
  if (!secret || secret.length < 32) throw new Error('Configure BETTER_AUTH_SECRET before enabling sign-in.');
  return betterAuth({
    appName: 'EasyFarm', baseURL: origin, secret, database,
    emailAndPassword: { enabled: false },
    socialProviders: googleClientId && googleClientSecret ? {
      google: { clientId: googleClientId, clientSecret: googleClientSecret, prompt: 'select_account' }
    } : {},
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    user: { additionalFields: {
      role: { type: ['pending', 'buyer', 'grower'], required: false, defaultValue: 'pending', input: false },
      organization: { type: 'string', required: false, defaultValue: '', input: false },
      location: { type: 'string', required: false, input: true }
    } },
    databaseHooks: { user: {
      create: { before: async user => {
        // Google supplies identity; the account's portal is assigned exactly once
        // by the authenticated profile-completion endpoint after OAuth returns.
        return { data: { ...user, role: 'pending', organization: '', location: '' } };
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
