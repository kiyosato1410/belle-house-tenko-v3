import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, onSnapshot, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const cfg = window.BELLE_FIREBASE_CONFIG || {};
const ready = cfg.apiKey && cfg.projectId;

if (!ready) {
  window.BELLE_CLOUD = null;
  window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "local" }));
} else {
  const app = initializeApp(cfg);
  const db = getFirestore(app);
  const col = name => collection(db, name);

  window.BELLE_CLOUD = {
    enabled: true,
    onRecords(cb){ return onSnapshot(col("records"), snap => cb(snap.docs.map(d => ({...d.data(), id:d.id})))); },
    onDrivers(cb){ return onSnapshot(col("drivers"), snap => cb(snap.docs.map(d => ({...d.data(), id:d.id})))); },
    onAdmins(cb){ return onSnapshot(col("admins"), snap => cb(snap.docs.map(d => ({...d.data(), id:d.id})))); },
    saveRecord(r){ return setDoc(doc(db, "records", r.id), r); },
    saveDriver(d){ return setDoc(doc(db, "drivers", d.id), d); },
    saveAdmin(a){ return setDoc(doc(db, "admins", a.id), a); },
    deleteDriver(id){ return deleteDoc(doc(db, "drivers", id)); },
    deleteAdmin(id){ return deleteDoc(doc(db, "admins", id)); }
  };
  window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "cloud" }));
}
