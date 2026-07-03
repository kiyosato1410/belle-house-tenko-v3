import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

try {
  const cfg = window.BELLE_FIREBASE_CONFIG || {};
  const ready = cfg.apiKey && cfg.projectId;

  if (!ready) {
    window.BELLE_CLOUD = null;
    window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "local" }));
  } else {
    const app = initializeApp(cfg);
    const db = getFirestore(app);

    window.BELLE_CLOUD = {
      enabled: true,

      onRecords(cb) {
        return onSnapshot(collection(db, "tenkoRecords"), snap => {
          cb(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });
      },

      onDrivers(cb) {
        return onSnapshot(collection(db, "drivers"), snap => {
          cb(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });
      },

      onAdmins(cb) {
        return onSnapshot(collection(db, "admins"), snap => {
          cb(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });
      },

      saveRecord(record) {
        return setDoc(doc(db, "tenkoRecords", record.id), record);
      },

      saveDriver(driver) {
        return setDoc(doc(db, "drivers", driver.id), driver);
      },

      saveAdmin(admin) {
        return setDoc(doc(db, "admins", admin.id), admin);
      },

      deleteDriver(id) {
        return deleteDoc(doc(db, "drivers", id));
      },

      deleteAdmin(id) {
        return deleteDoc(doc(db, "admins", id));
      }
    };

    window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "cloud" }));
  }
} catch (error) {
  console.error("Firebase sync error:", error);
  window.BELLE_CLOUD = null;
  window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail: "local" }));
}
