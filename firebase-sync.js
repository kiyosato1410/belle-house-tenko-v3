import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, onSnapshot, setDoc, doc, deleteDoc, getDocs, writeBatch, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function emit(detail){window.dispatchEvent(new CustomEvent("belle-cloud-status",{detail}))}

try{
  const cfg=window.BELLE_FIREBASE_CONFIG||{};
  if(!(cfg.apiKey&&cfg.projectId)){window.BELLE_CLOUD=null;emit("local")}
  else{
    const app=initializeApp(cfg),db=getFirestore(app);
    enableIndexedDbPersistence(db).catch(()=>{});
    const mapSnap=snap=>snap.docs.map(d=>({...d.data(),id:d.id}));
    const listen=(name,cb,label)=>onSnapshot(collection(db,name),snap=>cb(mapSnap(snap)),err=>{console.error(label+" sync error",err);emit("error")});
    async function clearCollection(name){const snap=await getDocs(collection(db,name));const batch=writeBatch(db);snap.docs.forEach(d=>batch.delete(d.ref));await batch.commit()}
    window.BELLE_CLOUD={
      enabled:true,
      onRecords:cb=>listen("tenkoRecords",cb,"records"),
      onDrivers:cb=>listen("drivers",cb,"drivers"),
      onAdmins:cb=>listen("admins",cb,"admins"),
      onDeleteRequests:cb=>listen("deleteRequests",cb,"delete requests"),
      onShifts:cb=>listen("shifts",cb,"shifts"),
      onNotices:cb=>listen("notices",cb,"notices"),
      saveRecord:r=>setDoc(doc(db,"tenkoRecords",String(r.id)),r,{merge:true}),
      saveDriver:d=>setDoc(doc(db,"drivers",String(d.id)),d,{merge:true}),
      saveAdmin:a=>setDoc(doc(db,"admins",String(a.id||a.name)),a,{merge:true}),
      saveDeleteRequest:r=>setDoc(doc(db,"deleteRequests",String(r.id)),r,{merge:true}),
      saveShift:s=>setDoc(doc(db,"shifts",String(s.id)),s,{merge:true}),
      saveNotice:n=>setDoc(doc(db,"notices",String(n.id)),n,{merge:true}),
      deleteDriver:id=>deleteDoc(doc(db,"drivers",String(id))),
      deleteAdmin:id=>deleteDoc(doc(db,"admins",String(id))),
      deleteShift:id=>deleteDoc(doc(db,"shifts",String(id))),
      deleteNotice:id=>deleteDoc(doc(db,"notices",String(id))),
      clearRecords:()=>clearCollection("tenkoRecords")
    };
    emit("cloud");
  }
}catch(error){console.error("Firebase sync error:",error);window.BELLE_CLOUD=null;emit("error")}
