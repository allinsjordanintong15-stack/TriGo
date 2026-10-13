// Grants (or revokes) the `admin: true` custom claim on a Firebase Auth account.
// The admin website and firestore.rules (isAdmin) check this claim; users/{uid}.role is
// not changed.
//
// Usage (from the repo root):
//   node scripts/setAdminClaim.mjs <email>            grant admin
//   node scripts/setAdminClaim.mjs <email> --revoke   remove admin
//
// Service-account key: secrets/serviceAccountKey.json, or the path in
// GOOGLE_APPLICATION_CREDENTIALS. secrets/ is git-ignored.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const KEY_WARNING =
  'REMINDER: the service-account key gives full admin access to the Firebase project. ' +
  'Never commit it, never share it, and keep it only in secrets/ (git-ignored).';

function fail(message) {
  console.error(`Error: ${message}`);
  console.error(KEY_WARNING);
  process.exit(1);
}

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const email = args.find((arg) => !arg.startsWith('--'));

if (!email) {
  fail('missing email. Usage: node scripts/setAdminClaim.mjs <email> [--revoke]');
}

const keyPath = resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || 'secrets/serviceAccountKey.json');
if (!existsSync(keyPath)) {
  fail(`service-account key not found at ${keyPath}`);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  fail(`could not read the service-account key at ${keyPath}`);
}

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

try {
  const user = await auth.getUserByEmail(email);
  // Keep any other custom claims the account already has.
  const claims = { ...(user.customClaims ?? {}) };
  if (revoke) {
    delete claims.admin;
  } else {
    claims.admin = true;
  }
  await auth.setCustomUserClaims(user.uid, claims);

  console.log(
    revoke
      ? `Removed admin claim from ${email} (uid ${user.uid}).`
      : `Granted admin claim to ${email} (uid ${user.uid}).`,
  );
  console.log('The change applies the next time that account signs in (or its ID token refreshes).');
  console.log(KEY_WARNING);
} catch (error) {
  fail(error?.code === 'auth/user-not-found' ? `no Firebase Auth account with email ${email}` : String(error?.message ?? error));
}
