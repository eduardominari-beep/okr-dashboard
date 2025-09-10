// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ HARD-CODED no código (sem process.env)
// Use os mesmos valores mostrados no Console do Firebase (SDK da Web)
const firebaseConfig = {
  apiKey: "AIzaSyAV6RbYoZh_2e_8dMeq5DoihuTZEiazP24",
  authDomain: "okr-dashboard-5a7f8.firebaseapp.com",
  projectId: "okr-dashboard-5a7f8",
  storageBucket: "okr-dashboard-5a7f8.appspot.com",
  messagingSenderId: "551080967814",
  appId: "1:551080967814:web:c1ad228e0f20241eaf5b07",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();