import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

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

// Test connection on boot to validate Firestore readiness
if (typeof window !== 'undefined') {
  (async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn("[Firebase] Client is offline or database initializing:", error.message);
      }
    }
  })();
}

// Initialize Firebase App Check ONLY if a valid site key is explicitly configured
export let appCheck: any = null;
if (typeof window !== 'undefined') {
  try {
    const metaEnv = (import.meta as any).env || {};
    const siteKey = metaEnv.VITE_RECAPTCHA_SITE_KEY || (firebaseConfig as any).recaptchaSiteKey;

    if (siteKey && typeof siteKey === 'string' && siteKey.trim().length > 10) {
      if (metaEnv.DEV) {
        (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = metaEnv.VITE_APP_CHECK_DEBUG_TOKEN || true;
      }
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey.trim()),
        isTokenAutoRefreshEnabled: true
      });
    }
  } catch (err) {
    console.warn("[AppCheck] Initialization warning:", err);
  }
}

export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    const res = await getToken(appCheck, false);
    return res.token;
  } catch (err) {
    console.warn("[AppCheck] Failed to obtain token:", err);
    return null;
  }
}
