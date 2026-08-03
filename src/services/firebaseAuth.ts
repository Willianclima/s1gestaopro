import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure persistent session in browser storage via Firebase Auth
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("Could not enable browserLocalPersistence in Firebase Auth:", err);
});

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Connection to Firestore verified successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("[Firebase] Client appears offline. Check Firebase configuration.");
    }
  }
}

testFirestoreConnection();

export interface UserProfileData {
  uid: string;
  email: string;
  name: string;
  document?: string;
  userType: 'admin' | 'gestor' | 'gestor_servicos' | 'profissional' | 'requisitante';
  warehouseId?: string;
  workLocation?: string;
  photoURL?: string;
  createdAt?: string;
}

export const getUserProfile = async (uid: string): Promise<UserProfileData | null> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserProfileData;
    }
    return null;
  } catch (err) {
    console.warn("[Firebase] Could not fetch user profile from Firestore:", err);
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfileData): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', profile.uid);
    await setDoc(userDocRef, {
      ...profile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${profile.uid}`);
  }
};

export const subscribeToAuthChanges = (
  onUserChanged: (user: User | null, profile: UserProfileData | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        // Create initial fallback profile from Auth info
        const isMasterAdmin = user.email?.toLowerCase() === 'willianclima@gmail.com';
        profile = {
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário'),
          document: isMasterAdmin ? '369.111.218-84' : '',
          userType: isMasterAdmin ? 'admin' : 'requisitante',
          photoURL: user.photoURL || undefined,
          createdAt: new Date().toISOString()
        };
        await saveUserProfile(profile);
      }
      onUserChanged(user, profile);
    } else {
      onUserChanged(null, null);
    }
  });
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const idToken = await user.getIdToken().catch(() => '');
      const tokenToUse = cachedAccessToken || idToken;
      if (onAuthSuccess) onAuthSuccess(user, tokenToUse);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string; profile: UserProfileData } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    const user = result.user;
    let profile = await getUserProfile(user.uid);
    if (!profile) {
      const isMasterAdmin = user.email?.toLowerCase() === 'willianclima@gmail.com';
      profile = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário Google'),
        document: isMasterAdmin ? '369.111.218-84' : '',
        userType: isMasterAdmin ? 'admin' : 'requisitante',
        photoURL: user.photoURL || undefined,
        createdAt: new Date().toISOString()
      };
      await saveUserProfile(profile);
    }

    return { user, accessToken: cachedAccessToken || '', profile };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailPasswordSignIn = async (email: string, pass: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;
  const profile = await getUserProfile(user.uid);
  return { user, profile };
};

export const emailPasswordSignUp = async (email: string, pass: string, profileData: Omit<UserProfileData, 'uid'>) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;
  const profile: UserProfileData = {
    ...profileData,
    uid: user.uid
  };
  await saveUserProfile(profile);
  return { user, profile };
};

export const getAccessToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return cachedAccessToken;
    }
  }
  return cachedAccessToken;
};

export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const logoutGoogle = logoutUser;
