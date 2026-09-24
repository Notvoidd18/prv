import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser } from '../types.ts';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const driveProvider = new GoogleAuthProvider();
driveProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveProvider.setCustomParameters({ prompt: 'select_account' });

const basicProvider = new GoogleAuthProvider();
basicProvider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Syncs user profile with backend database and returns registered AppUser with role
 */
export const syncUserWithBackend = async (firebaseUser: User): Promise<AppUser> => {
  const res = await fetch('/api/auth/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: firebaseUser.email,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
      picture: firebaseUser.photoURL || '',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to synchronize user session with server.');
  }

  const data = await res.json();
  return data.user;
};

/**
 * Standard Google Sign-In for students, teachers, and admins
 */
export const signInWithGoogle = async (): Promise<{
  user: User;
  appUser: AppUser;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, basicProvider);
    const appUser = await syncUserWithBackend(result.user);
    return { user: result.user, appUser };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Admin: Connects Google Drive with drive.file scope and initializes folders
 */
export const connectGoogleDrive = async (
  adminEmail: string
): Promise<{
  user: User;
  accessToken: string;
  serverResult: any;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Could not retrieve access token from Google.');
    }

    cachedAccessToken = credential.accessToken;

    // Send token to backend
    const serverRes = await fetch('/api/oauth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': adminEmail || result.user.email || '',
      },
      body: JSON.stringify({
        accessToken: cachedAccessToken,
        email: result.user.email,
        name: result.user.displayName || result.user.email,
        picture: result.user.photoURL,
      }),
    });

    const serverData = await serverRes.json();
    if (!serverRes.ok) {
      throw new Error(serverData.error || 'Server rejected Drive session.');
    }

    return {
      user: result.user,
      accessToken: cachedAccessToken,
      serverResult: serverData,
    };
  } catch (error: any) {
    console.error('Google Drive sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const disconnectGoogleDrive = async (adminEmail: string) => {
  try {
    await fetch('/auth/google/disconnect', {
      method: 'POST',
      headers: { 'x-user-email': adminEmail },
    });
  } catch (e) {
    console.error('Failed to notify backend on disconnect:', e);
  }
  cachedAccessToken = null;
};

export const signOutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const initAuthListener = (
  callback: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, callback);
};
