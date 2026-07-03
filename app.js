(function(){
'use strict';
const ADMIN_ID='admin', ADMIN_PASS='1234';
const LS_RECORDS='belle_house_tenko_v3_records', LS_DRIVERS='belle_house_tenko_v3_drivers';
let currentUser='', gpsData=null;
const CHECK_ITEMS=[
 ['alcDevice','アルコール検知器を使用した'],['alcNone','酒気帯びなし'],['healthGood','疾病・疲労・睡眠不足なし'],['sleepOk','睡眠不足なし'],
 ['licenseOk','運転免許証を携帯・有効確認'],['dailyInspection','日常点検を実施'],['vehicleOk','車両に異常なし'],['tireOk','タイヤ・灯火・ブレーキ確認'],
 ['cargoOk','積荷・荷崩れ防止確認'],['overloadOk','過積載なし'],['restOk','休憩・拘束時間に無理なし'],['instructionOk','運行上の注意事項を確認']
];
const $=id=>document.getElementById(id);
const nowText=()=>new Date().toLocaleString('ja-JP',{hour12:false});
const todayKey=()=>new Date().toLocaleDateString('ja-JP');
const isoDate=()=>new Date().toISOString().slice(0,10);
const getRecords=()=>JSON.parse(localStorage.getItem(LS_RECORDS)||'[]');
const setRecords=v=>localStorage.setItem(LS_RECORDS,JSON.stringify(v));
const getDrivers=()=>JSON.parse(localStorage.getItem(LS_DRIVERS)||'[]');
const setDrivers=v=>localStorage.setItem(LS_DRIVERS,JSON.stringify(v));
const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function init(){
 renderCheckList(); renderSettingsList(); bindEvents(); updateDashboard();
 if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
}
function bindEvents(){
 $('loginBtn').addEventListener('click',login);
 $('gpsBtn').addEventListener('click',getGPS);
 $('submitRollcallBtn').addEventListener('click',submitRollcall);
 $('driverLogoutBtn').addEventListener('click',logout);
 $('adminLogoutBtn').addEventListener('click',logout);
 $('exportCsvBtn').addEventListener('click',exportCSV);
 $('clearRecordsBtn').addEventListener('click',clearRecords);
 $('addDriverBtn').addEventListener('click',addDriver);
 $('recordFilter').addEventListener('change',renderRecords);
 $('driverSearch').addEventListener('input',renderRecords);
 $('dateSearch').addEventListener('change',renderRecords);
 document.querySelectorAll('.admin-nav button[data-tab]').forEach(b=>b.addEventListener('click',()=>showAdminTab(b.dataset.tab)));
 $('driversBody').addEventListener('click',e=>{ if(e.target.dataset.deleteDriver!==undefined) deleteDriver(Number(e.target.dataset.deleteDriver)); });
 $('photoInput').addEventListener('change',previewPhoto);
}
function renderCheckList(){ $('checkList').innerHTML=CHECK_ITEMS.map(([id,label])=>`<div class="check"><label><input type="checkbox" id="${id}">${safe(label)}</label></div>`).join(''); }
function renderSettingsList(){ $('settingsList').innerHTML=CHECK_ITEMS.map(([,label])=>`<li>${safe(label)}</li>`).join(''); }
function login(){
 const type=$('loginType').value, name=$('loginName').value.trim(), pass=$('loginPassword').value.trim();
 if(!name||!pass){ alert('名前とパスワードを入力してください'); return; }
 if(type==='admin'){
   if(name===ADMIN_ID && pass===ADMIN_PASS){ $('loginView').classList.add('hidden'); $('adminView').classList.remove('hidden'); showAdminTab('dashboard'); updateDashboard(); }
   else alert('管理者IDまたはパスワードが違います');
   return;
 }
 currentUser=name; $('currentDriver').textContent=name+' さん';
 const d=getDrivers().find(x=>x.name===name); if(d&&d.vehicle) $('vehicleNo').value=d.vehicle;
 $('loginView').classList.add('hidden'); $('driverView').classList.remove('hidden');
}
function logout(){ location.reload(); }
function getGPS(){
 if(!navigator.geolocation){ alert('この端末はGPSに対応していません'); return; }
 $('gpsText').value='取得中...';
 navigator.geolocation.getCurrentPosition(
  p=>{ gpsData={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,time:nowText()}; $('gpsText').value=`緯度:${gpsData.lat.toFixed(6)} 経度:${gpsData.lng.toFixed(6)} 精度:${Math.round(gpsData.accuracy)}m`; },
  ()=>{ gpsData=null; $('gpsText').value='取得失敗'; alert('GPS取得に失敗しました。位置情報を許可してください。'); },
  {enableHighAccuracy:true,timeout:10000,maximumAge:0}
 );
}
function previewPhoto(){
 const f=$('photoInput').files[0]; if(!f){ $('photoPreview').classList.add('hidden'); return; }
 const r=new FileReader(); r.onload=()=>{ $('photoPreview').src=r.result; $('photoPreview').classList.remove('hidden'); }; r.readAsDataURL(f);
}
function submitRollcall(){
 const checks={}; CHECK_ITEMS.forEach(([id])=>checks[id]=$(id).checked);
 const allOk=CHECK_ITEMS.every(([id])=>checks[id]);
 if(!allOk && !confirm('未チェック項目があります。要確認として送信しますか？')) return;
 const save=photo=>{
  const rec={id:String(Date.now()),ok:allOk,time:nowText(),date:todayKey(),isoDate:isoDate(),driver:currentUser,type:$('rollcallType').value,method:$('rollcallMethod').value,vehicleNo:$('vehicleNo').value.trim(),odometer:$('odometer').value.trim(),alcoholValue:$('alcoholValue').value.trim(),sleepHours:$('sleepHours').value.trim(),instruction:$('instruction').value.trim(),deliveryNote:$('deliveryNote').value.trim(),checks,gps:gpsData,photo:photo||'',remarks:$('remarks').value.trim()};
  const arr=getRecords(); arr.unshift(rec); setRecords(arr); alert('点呼を送信しました'); resetDriverForm();
 };
 const f=$('photoInput').files[0]; if(f){ const r=new FileReader(); r.onload=()=>save(r.result); r.readAsDataURL(f); } else save('');
}
function resetDriverForm(){
 ['odometer','alcoholValue','sleepHours','instruction','deliveryNote','remarks','gpsText','photoInput'].forEach(id=>$(id).value='');
 CHECK_ITEMS.forEach(([id])=>$(id).checked=false); $('photoPreview').classList.add('hidden'); gpsData=null;
}
function showAdminTab(tab){
 document.querySelectorAll('.admin-tab').forEach(e=>e.classList.add('hidden')); $(tab+'Tab').classList.remove('hidden');
 if(tab==='dashboard') updateDashboard(); if(tab==='records') renderRecords(); if(tab==='drivers') renderDrivers();
}
function updateDashboard(){
 const records=getRecords(), drivers=getDrivers();
 $('statToday').textContent=records.filter(r=>r.date===todayKey()).length;
 $('statNeedCheck').textContent=records.filter(r=>!r.ok).length;
 $('statDrivers').textContent=drivers.length;
}
function renderRecords(){
 const body=$('recordsBody'); let recs=getRecords();
 const filter=$('recordFilter').value, search=$('driverSearch').value.trim(), date=$('dateSearch').value;
 if(filter==='today') recs=recs.filter(r=>r.date===todayKey());
 if(filter==='need') recs=recs.filter(r=>!r.ok);
 if(search) recs=recs.filter(r=>(r.driver||'').includes(search));
 if(date) recs=recs.filter(r=>r.isoDate===date);
 if(!recs.length){ body.innerHTML='<tr><td colspan="9">履歴はありません</td></tr>'; return; }
 body.innerHTML=recs.map(r=>{
  const checks=CHECK_ITEMS.map(([id,label])=>(r.checks?.[id]?'✅':'❌')+safe(label)).join('<br>');
  const gps=r.gps?`<a class="maplink" target="_blank" href="https://www.google.com/maps?q=${r.gps.lat},${r.gps.lng}">地図</a><br><span class="muted">${Number(r.gps.lat).toFixed(5)}, ${Number(r.gps.lng).toFixed(5)}<br>精度:${Math.round(r.gps.accuracy||0)}m</span>`:'';
  const photo=r.photo?`<img class="photo" src="${r.photo}">`:'';
  return `<tr><td class="${r.ok?'status-ok':'status-ng'}">${r.ok?'OK':'要確認'}</td><td>${safe(r.time)}</td><td>${safe(r.type)}<br><span class="muted">${safe(r.method)}</span></td><td>${safe(r.driver)}</td><td>${safe(r.vehicleNo)}<br><span class="muted">${safe(r.odometer)}</span></td><td>${checks}<br>ALC:${safe(r.alcoholValue)}<br>睡眠:${safe(r.sleepHours)}</td><td>${gps}</td><td>${photo}</td><td>${safe(r.instruction)}<br>${safe(r.deliveryNote)}<br>${safe(r.remarks)}</td></tr>`;
 }).join('');
}
function addDriver(){
 const name=$('newDriverName').value.trim(); if(!name){ alert('ドライバー名を入力してください'); return; }
 const d={id:String(Date.now()),name,tel:$('newDriverTel').value.trim(),license:$('newDriverLicense').value,vehicle:$('newDriverVehicle').value.trim(),memo:$('newDriverMemo').value.trim(),created:nowText()};
 const arr=getDrivers(); arr.unshift(d); setDrivers(arr);
 ['newDriverName','newDriverTel','newDriverLicense','newDriverVehicle','newDriverMemo'].forEach(id=>$(id).value='');
 renderDrivers(); updateDashboard();
}
function renderDrivers(){
 const body=$('driversBody'), drivers=getDrivers();
 if(!drivers.length){ body.innerHTML='<tr><td colspan="7">登録ドライバーはありません</td></tr>'; return; }
 body.innerHTML=drivers.map((d,i)=>`<tr><td>${safe(d.name)}</td><td>${safe(d.tel)}</td><td>${safe(d.license)}</td><td>${safe(d.vehicle)}</td><td>${safe(d.memo)}</td><td>${safe(d.created)}</td><td><button class="danger" data-delete-driver="${i}">削除</button></td></tr>`).join('');
}
function deleteDriver(i){ if(!confirm('このドライバーを削除しますか？')) return; const arr=getDrivers(); arr.splice(i,1); setDrivers(arr); renderDrivers(); updateDashboard(); }
function exportCSV(){
 const rows=[['判定','日時','点呼区分','点呼方法','名前','車両番号','メーター','アルコール数値','睡眠時間','緯度','経度','GPS精度m','安全チェック','指示事項','配送注意','備考']];
 getRecords().forEach(r=>rows.push([r.ok?'OK':'要確認',r.time,r.type,r.method,r.driver,r.vehicleNo||'',r.odometer||'',r.alcoholValue||'',r.sleepHours||'',r.gps?.lat||'',r.gps?.lng||'',r.gps?.accuracy||'',CHECK_ITEMS.map(([id,label])=>`${label}:${r.checks?.[id]?'OK':'NG'}`).join(' / '),r.instruction||'',r.deliveryNote||'',r.remarks||'']));
 const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\\r\\n');
 const blob=new Blob(['\\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='belle-house-tenko-v3.csv'; a.click();
}
function clearRecords(){ if(confirm('点呼履歴をすべて削除しますか？')){ localStorage.removeItem(LS_RECORDS); renderRecords(); updateDashboard(); } }
document.addEventListener('DOMContentLoaded',init);
})();