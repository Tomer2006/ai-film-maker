import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

type PublicFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function getFirebaseConfig(): PublicFirebaseConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  const messagingSenderId =
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  const measurementId =
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim() || undefined;

  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !storageBucket ||
    !messagingSenderId ||
    !appId
  ) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };
}

export function getFirebaseClientApp(): FirebaseApp | null {
  const config = getFirebaseConfig();
  if (!config) return null;

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config);
}

export async function initFirebaseAnalytics() {
  if (typeof window === "undefined") return null;

  const app = getFirebaseClientApp();
  if (!app) return null;

  const { isSupported, getAnalytics } = await import("firebase/analytics");
  if (!(await isSupported())) {
    return null;
  }

  return getAnalytics(app);
}
