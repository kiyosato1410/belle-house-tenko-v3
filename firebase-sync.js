import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function status(detail, message = "") {
  window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail, message }));
}

try {
  const cfg = window.BELLE_FIREBASE_CONFIG || {};
  const ready = !!(cfg.apiKey && cfg.projectId);

  if (!ready) {
    window.BELLE_CLOUD = null;
    status("local", "firebase-config.js が未設定です");
  } else {
    const app = initializeApp(cfg);
    const db = getFirestore(app);

    const listen = (name, cb) => onSnapshot(
      collection(db, name),
      snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      error => {
        console.error("Firestore listen error:", name, error);
        status("error", error.message || String(error));
      }
    );

    const clean = data => {
      const obj = { ...data };
      Object.keys(obj).forEach(k => obj[k] === undefined && delete obj[k]);
      obj.updatedAt = serverTimestamp();
      return obj;
    };

    window.BELLE_CLOUD = {
      enabled: true,
      onRecords(cb) { return listen("tenkoRecords", cb); },
      onDrivers(cb) { return listen("drivers", cb); },
      onAdmins(cb) { return listen("admins", cb); },
      saveRecord(record) { return setDoc(doc(db, "tenkoRecords", String(record.id)), clean(record), { merge: true }); },
      saveDriver(driver) { return setDoc(doc(db, "drivers", String(driver.id)), clean(driver), { merge: true }); },
      saveAdmin(admin) { return setDoc(doc(db, "admins", String(admin.id)), clean(admin), { merge: true }); },
      deleteDriver(id) { return deleteDoc(doc(db, "drivers", String(id))); },
      deleteAdmin(id) { return deleteDoc(doc(db, "admins", String(id))); }
    };

    status("cloud", "Firebase接続OK");
  }
} catch (error) {
  console.error("Firebase sync error:", error);
  window.BELLE_CLOUD = null;
  status("error", error.message || String(error));
}
