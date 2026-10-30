import {
  collection, addDoc, getDocs, query, where, doc,
  updateDoc, setDoc, Timestamp, deleteDoc, limit,
} from "firebase/firestore";
import * as firebaseAuth from "firebase/auth";
import { db, auth, googleProvider } from "../firebaseConfig";
import { UserRole, Institution, StatData } from "../types";
import { API_BASE } from "../config";

export interface FixedInstitution extends Institution { logo?: string; }
export interface Organisation {
  name: string; contactName: string; mobileNo: string;
  email: string; status: "PENDING" | "ACTIVE" | "REJECTED";
  uid: string; createdAt: Timestamp;
}
export interface FixedOrganisation extends Organisation { id: string; }

export interface Session {
  role: UserRole;
  uid: string;
  email: string | null;
  name: string;
  id: string;            // institution / organisation doc id, or uid for other roles
  avatar?: string | null;
}

export type VerificationOutcome = "AUTHENTIC" | "SUSPICIOUS" | "FORGED" | "NOT_FOUND";

// One row of the backend's verification log
export interface VerificationLogEntry {
  source: "upload" | "manual";
  file_name?: string | null;
  roll_no?: string | null;
  semester?: string | null;
  student_name?: string | null;
  result: VerificationOutcome;
  risk_level?: string | null;
  created_at: string;
}

export interface AdminStats {
  total: number;
  by_result: Record<VerificationOutcome, number>;
  monthly: StatData[];
  recent: VerificationLogEntry[];
}

export interface InstitutionRecord {
  roll_no?: string;
  semester?: string;
  name?: string;
  cgpa?: number;
  uploaded_at?: string;
}

let confirmationResult: firebaseAuth.ConfirmationResult | null = null;

// Call the FastAPI backend with the signed-in user's Firebase ID token
export const backendFetch = async (path: string, init: RequestInit = {}) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to continue.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  return fetch(`${API_BASE}${path}`, { ...init, headers });
};

// backendFetch + JSON parsing; throws the backend's error message on failure
export const backendJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await backendFetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `Server error ${res.status}`);
  }
  return body as T;
};

const findOwnedDoc = async (collectionName: string, uid: string) => {
  const snapshot = await getDocs(query(collection(db, collectionName), where("uid", "==", uid), limit(1)));
  return snapshot.empty ? null : snapshot.docs[0];
};

const saveCitizenProfile = (user: firebaseAuth.User, fields: Record<string, unknown>) =>
  setDoc(doc(db, "users", user.uid), { ...fields, role: UserRole.USER, lastLogin: Timestamp.now() }, { merge: true });

// Sign in with email/password and require the resulting session to have `role`
const loginAs = async (email: string, pass: string, role: UserRole, notFoundMessage: string) => {
  const { user } = await firebaseAuth.signInWithEmailAndPassword(auth, email, pass);
  try {
    const session = await api.getSession(user, true);
    if (session.role !== role) throw new Error(notFoundMessage);
    return session;
  } catch (e) {
    await firebaseAuth.signOut(auth);
    throw e;
  }
};

export const api = {

  // ── SESSION ────────────────────────────────────────────────────────────
  // The role comes from verifiable sources, never from client storage:
  // admin custom claim → approved institution → organisation → citizen.
  // Backend endpoints and Firestore rules enforce the same rules server-side.
  getSession: async (user: firebaseAuth.User, forceRefresh = false): Promise<Session> => {
    const base = { uid: user.uid, email: user.email, name: user.displayName || "User", id: user.uid, avatar: user.photoURL };

    const { claims } = await user.getIdTokenResult(forceRefresh);
    if (claims.admin === true) return { ...base, role: UserRole.ADMIN, name: user.displayName || "Administrator" };

    const inst = await findOwnedDoc("institutions", user.uid);
    if (inst) {
      const data = inst.data() as FixedInstitution;
      if (data.status === "PENDING") throw new Error("Your account is pending approval.");
      if (data.status === "REJECTED") throw new Error("Your account request was rejected.");
      return { ...base, role: UserRole.INSTITUTION, name: data.name, id: inst.id };
    }

    const org = await findOwnedDoc("organisations", user.uid);
    if (org) return { ...base, role: UserRole.ORGANISATION, name: (org.data() as Organisation).name, id: org.id };

    return { ...base, role: UserRole.USER };
  },

  // ── CITIZEN: Google Login (redirect-based, COOP-safe) ──────────────────

  loginGoogleRedirect: async () => {
    // Call this to START the login — page will redirect to Google
    await firebaseAuth.signInWithRedirect(auth, googleProvider);
  },

  handleGoogleRedirectResult: async () => {
    // Call this on page load to CHECK if we came back from Google
    const result = await firebaseAuth.getRedirectResult(auth);
    if (!result) return null; // No redirect in progress

    const session = await api.getSession(result.user);
    if (session.role === UserRole.USER) {
      await saveCitizenProfile(result.user, { name: result.user.displayName, email: result.user.email });
    }
    return session;
  },

  // Keep popup as fallback (works in some browsers)
  loginGoogle: async () => {
    try {
      const { user } = await firebaseAuth.signInWithPopup(auth, googleProvider);
      const session = await api.getSession(user);
      if (session.role === UserRole.USER) {
        await saveCitizenProfile(user, { name: user.displayName, email: user.email });
      }
      return session;
    } catch (error: any) {
      // If popup blocked, fall back to redirect
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/popup-closed-by-user' ||
        error.message?.includes('Cross-Origin')
      ) {
        await firebaseAuth.signInWithRedirect(auth, googleProvider);
        return null; // page will redirect
      }
      console.error("Google Auth Error:", error);
      throw error;
    }
  },

  // ── CITIZEN: Mobile OTP ────────────────────────────────────────────────

  sendOtp: async (phoneNumber: string, recaptchaDivId: string) => {
    const recaptchaVerifier = new firebaseAuth.RecaptchaVerifier(
      auth, recaptchaDivId, { size: "invisible" }
    );
    confirmationResult = await firebaseAuth.signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return true;
  },

  verifyOtp: async (otp: string) => {
    if (!confirmationResult) throw new Error("OTP was not sent or expired.");
    const { user } = await confirmationResult.confirm(otp);
    await saveCitizenProfile(user, { mobile: user.phoneNumber });
    return { ...(await api.getSession(user)), name: "Citizen User" };
  },

  // ── ADMIN / INSTITUTION / ORGANISATION LOGIN ───────────────────────────

  loginAdmin: (email: string, pass: string) =>
    loginAs(email, pass, UserRole.ADMIN, "This account does not have administrator access."),

  loginInstitution: (email: string, pass: string) =>
    loginAs(email, pass, UserRole.INSTITUTION, "Institution not registered."),

  loginOrganisation: (email: string, pass: string) =>
    loginAs(email, pass, UserRole.ORGANISATION, "Organisation not registered."),

  // ── LOGOUT ─────────────────────────────────────────────────────────────
  logout: async () => { await firebaseAuth.signOut(auth); },

  // ── REGISTER INSTITUTION ───────────────────────────────────────────────
  registerInstitution: async (data: any) => {
    const userCredential = await firebaseAuth.createUserWithEmailAndPassword(auth, data.contactEmail, data.password);
    await addDoc(collection(db, "institutions"), {
      name: data.name, code: data.code, type: data.type, address: data.address,
      district: data.district, principalName: data.principalName,
      contactEmail: data.contactEmail, mobile: data.mobile,
      status: "PENDING", uid: userCredential.user.uid, createdAt: Timestamp.now(),
    });
    await firebaseAuth.signOut(auth);
    return true;
  },

  // ── REGISTER ORGANISATION ──────────────────────────────────────────────
  registerOrganisation: async (data: any) => {
    const userCredential = await firebaseAuth.createUserWithEmailAndPassword(auth, data.email, data.password);
    await addDoc(collection(db, "organisations"), {
      name: data.organisationName, contactName: data.contactName,
      mobileNo: data.mobileNo, email: data.email,
      status: "PENDING", uid: userCredential.user.uid, createdAt: Timestamp.now(),
    });
    await firebaseAuth.signOut(auth);
    return true;
  },

  // ── INSTITUTION LIST ───────────────────────────────────────────────────
  getAllInstitutions: async () => {
    const snapshot = await getDocs(collection(db, "institutions"));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FixedInstitution[];
  },

  updateInstitutionStatus: async (id: string, status: "ACTIVE" | "REJECTED") => {
    await updateDoc(doc(db, "institutions", id), { status });
    return true;
  },

  deleteInstitution: async (id: string) => {
    await deleteDoc(doc(db, "institutions", id));
    return true;
  },

  // ── BACKEND DATA ───────────────────────────────────────────────────────
  getMyVerifications: () =>
    backendJson<{ verifications: VerificationLogEntry[] }>("/verifications/mine").then(r => r.verifications),

  getInstitutionRecords: () =>
    backendJson<{ records: InstitutionRecord[] }>("/institution/records").then(r => r.records),

  getAdminStats: () => backendJson<AdminStats>("/admin/stats"),
};
