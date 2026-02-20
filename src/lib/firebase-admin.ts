import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    let parsed: {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    try {
      parsed = JSON.parse(serviceAccountJson) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
    } catch {
      throw new Error(
        "Invalid FIREBASE_SERVICE_ACCOUNT_JSON. Expected valid JSON service account credentials.",
      );
    }

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields: project_id, client_email, private_key.",
      );
    }

    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: normalizePrivateKey(parsed.private_key),
      }),
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: normalizePrivateKey(privateKey),
      }),
    });
  }

  if (projectId || clientEmail || privateKey) {
    const missing = [
      !projectId ? "FIREBASE_PROJECT_ID" : null,
      !clientEmail ? "FIREBASE_CLIENT_EMAIL" : null,
      !privateKey ? "FIREBASE_PRIVATE_KEY" : null,
    ].filter(Boolean);

    throw new Error(
      `Incomplete Firebase credentials. Missing: ${missing.join(", ")}.`,
    );
  }

  return initializeApp();
}

export function getDb() {
  return getFirestore(initializeFirebaseAdmin());
}
