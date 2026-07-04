import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  getDocs,
  writeBatch,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function emit(detail) {
  window.dispatchEvent(new CustomEvent("belle-cloud-status", { detail }));
}

try {
  const cfg = window.BELLE_FIREBASE_CONFIG || {};
  const ready = !!(cfg.apiKey && cfg.projectId);

  if (!ready) {
    window.BELLE_CLOUD = null;
    emit("local");
  } else {
    const app = initializeApp(cfg);
    const db = getFirestore(app);

    enableIndexedDbPersistence(db).catch(() => {
      // 複数タブ起動時などは失敗しても同期自体は継続します。
    });

    const mapSnap = snap => snap.docs.map(d => ({ ...d.data(), id: d.id }));

    async function clearCollection(name) {
      const snap = await getDocs(collection(db, name));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    window.BELLE_CLOUD = {
      enabled: true,

      onRecords(cb) {
        return onSnapshot(
          collection(db, "tenkoRecords"),
          snap => cb(mapSnap(snap)),
          err => { console.error("records sync error", err); emit("error"); }
        );
      },

      onDrivers(cb) {
        return onSnapshot(
          collection(db, "drivers"),
          snap => cb(mapSnap(snap)),
          err => { console.error("drivers sync error", err); emit("error"); }
        );
      },

      onAdmins(cb) {
        return onSnapshot(
          collection(db, "admins"),
          snap => cb(mapSnap(snap)),
          err => { console.error("admins sync error", err); emit("error"); }
        );
      },

      saveRecord(record) {
        return setDoc(doc(db, "tenkoRecords", String(record.id)), record, { merge: true });
      },

      saveDriver(driver) {
        return setDoc(doc(db, "drivers", String(driver.id)), driver, { merge: true });
      },

      saveAdmin(admin) {
        return setDoc(doc(db, "admins", String(admin.id || admin.name)), admin, { merge: true });
      },

      deleteDriver(id) {
        return deleteDoc(doc(db, "drivers", String(id)));
      },

      deleteAdmin(id) {
        return deleteDoc(doc(db, "admins", String(id)));
      },

      clearRecords() {
        return clearCollection("tenkoRecords");
      }
    };

    emit("cloud");
  }
} catch (error) {
  console.error("Firebase sync error:", error);
  window.BELLE_CLOUD = null;
  emit("error");
}
