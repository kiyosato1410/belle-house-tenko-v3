import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

try {
  const cfg = window.BELLE_FIREBASE_CONFIG || {};
  const ready = !!(cfg.apiKey && cfg.projectId);

  if (!ready) {
    window.BELLE_CLOUD = null;
    window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "local" }));
  } else {
    const app = initializeApp(cfg);
    const db = getFirestore(app);

    const listen = (name, cb) => onSnapshot(
      collection(db, name),
      snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      error => {
        console.error(`Firestore listen error: ${name}`, error);
        window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "error" }));
      }
    );

    const clearCollection = async (name) => {
      const snap = await getDocs(collection(db, name));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    };

    window.BELLE_CLOUD = {
      enabled: true,
      onRecords(cb) { return listen("tenkoRecords", cb); },
      onDrivers(cb) { return listen("drivers", cb); },
      onAdmins(cb) { return listen("admins", cb); },
      saveRecord(record) { return setDoc(doc(db, "tenkoRecords", String(record.id)), record); },
      saveDriver(driver) { return setDoc(doc(db, "drivers", String(driver.id)), driver); },
      saveAdmin(admin) { return setDoc(doc(db, "admins", String(admin.id || admin.name)), admin); },
      deleteRecord(id) { return deleteDoc(doc(db, "tenkoRecords", String(id))); },
      deleteDriver(id) { return deleteDoc(doc(db, "drivers", String(id))); },
      deleteAdmin(id) { return deleteDoc(doc(db, "admins", String(id))); },
      clearRecords() { return clearCollection("tenkoRecords"); }
    };

    window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "cloud" }));
  }
} catch (error) {
  console.error("Firebase sync error:", error);
  window.BELLE_CLOUD = null;
  window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "error" }));
}
