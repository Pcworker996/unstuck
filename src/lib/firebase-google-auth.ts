import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut
} from "firebase/auth";

export type FirebaseGoogleUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  getIdToken: () => Promise<string>;
};

export type FirebaseGoogleAuthOperations = {
  signInWithGoogle: () => Promise<FirebaseGoogleUser>;
  currentUser: () => FirebaseGoogleUser | undefined | null;
  signOut: () => Promise<void>;
};

export type FirebaseGoogleAuthClient = {
  signIn: () => Promise<{ id: string; displayName: string }>;
  currentPerson: () => Promise<{ id: string; displayName: string } | undefined>;
  idToken: () => Promise<string | undefined>;
  signOut: () => Promise<void>;
};

let client: FirebaseGoogleAuthClient | undefined;

export function createFirebaseGoogleAuthClient(
  operations: FirebaseGoogleAuthOperations
): FirebaseGoogleAuthClient {
  function personFor(user: FirebaseGoogleUser): { id: string; displayName: string } {
    return {
      id: user.uid,
      displayName: user.displayName?.trim() || user.email?.trim() || "there"
    };
  }

  return {
    async signIn() {
      return personFor(await operations.signInWithGoogle());
    },
    async currentPerson() {
      const user = operations.currentUser();
      return user ? personFor(user) : undefined;
    },
    async idToken() {
      return operations.currentUser()?.getIdToken();
    },
    signOut: operations.signOut
  };
}

export function getFirebaseGoogleAuthClient(): FirebaseGoogleAuthClient {
  if (client) {
    return client;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfiguration());
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  client = createFirebaseGoogleAuthClient({
    async signInWithGoogle() {
      return (await signInWithPopup(auth, provider)).user;
    },
    currentUser: () => auth.currentUser,
    signOut: () => firebaseSignOut(auth)
  });
  return client;
}

export function resetFirebaseGoogleAuthClientForTests(): void {
  client = undefined;
}

function firebaseConfiguration(): {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
} {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error("Firebase browser configuration is incomplete.");
  }

  return { apiKey, authDomain, projectId, appId };
}
