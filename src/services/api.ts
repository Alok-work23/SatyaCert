import {
  collection, addDoc, getDocs, query, where, doc,
  updateDoc, setDoc, Timestamp, orderBy, deleteDoc,
} from "firebase/firestore";
import * as firebaseAuth from "firebase/auth";
import { db, auth, googleProvider, storage } from "../firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { UserRole, Institution, VerificationRequest } from "../types";
import { MONTHLY_STATS } from "../constants";

export interface FixedInstitution extends Institution { logo?: string; }
export interface Organisation {
  name: string; contactName: string; mobileNo: string;
  email: string; status: "PENDING" | "ACTIVE" | "REJECTED";
  uid: string; createdAt: Timestamp;
}
export interface FixedOrganisation extends Organisation { id: string; }

let confirmationResult: firebaseAuth.ConfirmationResult | null = null;

export const api = {

  // ── CITIZEN: Google Login (redirect-based, COOP-safe) ──────────────────

  loginGoogleRedirect: async () => {
    // Call this to START the login — page will redirect to Google
    await firebaseAuth.signInWithRedirect(auth, googleProvider);
  },

  handleGoogleRedirectResult: async () => {
    // Call this on page load to CHECK if we came back from Google
    const result = await firebaseAuth.getRedirectResult(auth);
    if (!result) return null; // No redirect in progress

    const user = result.user;
    await setDoc(
      doc(db, "users", user.uid),
      {
        name: user.displayName,
        email: user.email,
        role: UserRole.USER,
        lastLogin: Timestamp.now(),
      },
      { merge: true }
    );

    return {
      name: user.displayName || "User",
      email: user.email,
      role: UserRole.USER,
      token: await user.getIdToken(),
      avatar: user.photoURL,
      uid: user.uid,
    };
  },

  // Keep popup as fallback (works in some browsers)
  loginGoogle: async () => {
    try {
      const result = await firebaseAuth.signInWithPopup(auth, googleProvider);
      const user = result.user;
      await setDoc(
        doc(db, "users", user.uid),
        { name: user.displayName, email: user.email, role: UserRole.USER, lastLogin: Timestamp.now() },
        { merge: true }
      );
      return {
        name: user.displayName || "User",
        email: user.email,
        role: UserRole.USER,
        token: await user.getIdToken(),
        avatar: user.photoURL,
        uid: user.uid,
      };
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
    const result = await confirmationResult.confirm(otp);
    const user = result.user;
    await setDoc(
      doc(db, "users", user.uid),
      { mobile: user.phoneNumber, role: UserRole.USER, lastLogin: Timestamp.now() },
      { merge: true }
    );
    return {
      name: "Citizen User", mobile: user.phoneNumber,
      role: UserRole.USER, token: await user.getIdToken(), uid: user.uid,
    };
  },

  // ── INSTITUTION LOGIN ──────────────────────────────────────────────────

  loginInstitution: async (email: string, pass: string) => {
    const result = await firebaseAuth.signInWithEmailAndPassword(auth, email, pass);
    const q = query(collection(db, "institutions"), where("contactEmail", "==", email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error("Institution not registered.");
    const instData = snapshot.docs[0].data() as FixedInstitution;
    if (instData.status === "PENDING") throw new Error("Your account is pending approval.");
    if (instData.status === "REJECTED") throw new Error("Your account request was rejected.");
    return {
      name: instData.name, role: UserRole.INSTITUTION,
      id: snapshot.docs[0].id, token: await result.user.getIdToken(), uid: result.user.uid,
    };
  },

  // ── ORGANISATION LOGIN ─────────────────────────────────────────────────

  loginOrganisation: async (email: string, pass: string) => {
    const result = await firebaseAuth.signInWithEmailAndPassword(auth, email, pass);
    const q = query(collection(db, "organisations"), where("email", "==", email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error("Organisation not registered.");
    const orgData = snapshot.docs[0].data() as FixedOrganisation;
    return {
      name: orgData.name, role: UserRole.ORGANISATION,
      id: snapshot.docs[0].id, token: await result.user.getIdToken(), uid: result.user.uid,
    };
  },

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

  // ── VERIFICATION QUEUE ─────────────────────────────────────────────────
  submitVerificationRequest: async (file: File, userId: string) => {
    const docRef = await addDoc(collection(db, "verification_queue"), {
      userId, fileName: file.name, status: "PENDING",
      type: "DOCUMENT", submittedAt: Timestamp.now(),
    });
    return { requestId: docRef.id };
  },

  submitManualRequest: async (details: any, userId: string) => {
    const docRef = await addDoc(collection(db, "verification_queue"), {
      userId, details, status: "PENDING", type: "MANUAL", submittedAt: Timestamp.now(),
    });
    return { requestId: docRef.id };
  },

  getUserRequests: async (userId: string) => {
    if (!userId) return [];
    try {
      const q = query(
        collection(db, "verification_queue"),
        where("userId", "==", userId),
        orderBy("submittedAt", "desc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, submittedAt: data.submittedAt?.toDate?.()?.toLocaleString() || "" } as VerificationRequest;
      });
    } catch {
      const q = query(collection(db, "verification_queue"), where("userId", "==", userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VerificationRequest));
    }
  },

  // ── ORGANISATION UPLOADS ───────────────────────────────────────────────
  uploadOrganisationDocument: async (formData: FormData) => {
    const file = formData.get("file") as File;
    const organisationId = formData.get("organisationId") as string;
    if (!file || !organisationId) throw new Error("File or organisationId missing");
    const fileRef = ref(storage, `organisation_uploads/${organisationId}/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(fileRef, file);
    const fileUrl = await getDownloadURL(snap.ref);
    const docRef = await addDoc(collection(db, "organisation_uploads"), {
      organisationId, fileName: file.name, fileUrl, status: "PENDING", uploadedAt: Timestamp.now(),
    });
    return { id: docRef.id };
  },

  getOrganisationUploads: async (organisationId: string) => {
    if (!organisationId) return [];
    const snapshot = await getDocs(query(
      collection(db, "organisation_uploads"),
      where("organisationId", "==", organisationId)
    ));
    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.uploadedAt?.toMillis?.() || 0) - (a.uploadedAt?.toMillis?.() || 0));
  },

  // ── ADMIN STATS ────────────────────────────────────────────────────────
  getAdminStats: async () => MONTHLY_STATS,
};