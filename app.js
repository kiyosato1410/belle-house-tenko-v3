
(function(){
'use strict';
const ADMIN_ID='admin',ADMIN_PASS='1234',LS_RECORDS='belle_house_tenko_v40_records',LS_DRIVERS='belle_house_tenko_v40_drivers',LS_ADMINS='belle_house_tenko_v40_admins';
const APP_VERSION='Ver.6.0';
let currentUser='',gpsData=null;
let cloudStarted=false;
let cloudRetryCount=0;
let cloudLastError='';
const cloudUnsubs=[];
const CHECK_ITEMS=[['alcDevice','アルコール検知器を使用した'],['alcNone','酒気帯びなし'],['healthGood','疾病・疲労・睡眠不足なし'],['sleepOk','睡眠不足なし'],['licenseOk','運転免許証を携帯・有効確認'],['dailyInspection','日常点検を実施'],['vehicleOk','車両に異常なし'],['tireOk','タイヤ・灯火・ブレーキ確認'],['cargoOk','積荷・荷崩れ防止確認'],['overloadOk','過積載なし'],['restOk','休憩・拘束時間に無理なし'],['instructionOk','運行上の注意事項を確認']];
const $=id=>document.getElementById(id);const nowText=()=>new Date().toLocaleString('ja-JP',{hour12:false});const todayKey=()=>new Date().toLocaleDateString('ja-JP');const isoDate=()=>new Date().toISOString().slice(0,10);const monthKey=()=>new Date().toISOString().slice(0,7);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const getLocal=k=>JSON.parse(localStorage.getItem(k)||'[]');const setLocal=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const getRecords=()=>getLocal(LS_RECORDS);const getDrivers=()=>getLocal(LS_DRIVERS);const getAdmins=()=>getLocal(LS_ADMINS);
function init(){
  updateSyncStatus();
  renderCheckList();
  bindEvents();
  startCloudSync();
  window.addEventListener('belle-cloud-status',e=>{cloudLastError=e?.detail==='error'?'Firebase接続エラー':'';updateSyncStatus();startCloudSync();});
  window.addEventListener('online',()=>updateSyncStatus());
  window.addEventListener('offline',()=>updateSyncStatus());
  if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}
}
function updateSyncStatus(){
  const badge=$('syncStatus');
  if(!badge)return;
  const cloud=!!(window.BELLE_CLOUD&&window.BELLE_CLOUD.enabled);
  if(cloudLastError){
    badge.textContent='同期エラー';
    badge.title=cloudLastError;
    badge.className='sync-badge local';
    return;
  }
  badge.textContent=cloud?(navigator.onLine?'クラウド同期ON':'オフライン保存中'):'ローカル保存';
  badge.title=cloud?'Firebaseに接続しています':'firebase-config.js / firebase-sync.js を確認してください';
  badge.className='sync-badge '+(cloud?'cloud':'local');
}
function sortByNewest(a){return [...(a||[])].sort((x,y)=>String(y.createdAt||y.time||y.id||'').localeCompare(String(x.createdAt||x.time||x.id||'')))}
function refreshCurrentViews(){
  updateDashboard();
  renderDriverOptions();
  renderRecords();
  renderDrivers();
  renderAdmins();
}
function startCloudSync(){
  const cloud=window.BELLE_CLOUD;
  if(cloudStarted)return;
  if(!cloud||!cloud.enabled){
    if(cloudRetryCount<20){cloudRetryCount++;setTimeout(startCloudSync,500);}
    return;
  }
  cloudStarted=true;
  updateSyncStatus();
  if(cloud.onRecords){cloudUnsubs.push(cloud.onRecords(records=>{setLocal(LS_RECORDS,sortByNewest(records));refreshCurrentViews();}));}
  if(cloud.onDrivers){cloudUnsubs.push(cloud.onDrivers(drivers=>{setLocal(LS_DRIVERS,sortByNewest(drivers));refreshCurrentViews();}));}
  if(cloud.onAdmins){cloudUnsubs.push(cloud.onAdmins(admins=>{setLocal(LS_ADMINS,sortByNewest(admins));refreshCurrentViews();}));}
  uploadLocalDataToCloud();
}
async function uploadLocalDataToCloud(){
  const c=window.BELLE_CLOUD;
  if(!c||!c.enabled)return;
  try{
    for(const rec of getRecords()) if(rec&&rec.id&&c.saveRecord) await c.saveRecord(rec);
    for(const d of getDrivers()) if(d&&d.id&&c.saveDriver) await c.saveDriver(d);
    for(const a of getAdmins()) if(a&&a.id&&c.saveAdmin) await c.saveAdmin(a);
  }catch(e){console.warn('Local upload skipped',e)}
}
async function cloudSave(kind,data){
  const c=window.BELLE_CLOUD;
  if(!c||!c.enabled)return;
  try{
    if(kind==='record'&&c.saveRecord)await c.saveRecord(data);
    if(kind==='driver'&&c.saveDriver)await c.saveDriver(data);
    if(kind==='admin'&&c.saveAdmin)await c.saveAdmin(data);
  }catch(e){console.error('Cloud save error',e);alert('クラウド保存に失敗しました。通信状態またはFirestoreルールを確認してください。');}
}
async function cloudDelete(kind,id){
  const c=window.BELLE_CLOUD;
  if(!c||!c.enabled)return;
  try{
    if(kind==='driver'&&c.deleteDriver)await c.deleteDriver(String(id));
    if(kind==='admin'&&c.deleteAdmin)await c.deleteAdmin(String(id));
  }catch(e){console.error('Cloud delete error',e);alert('クラウド削除に失敗しました。通信状態またはFirestoreルールを確認してください。');}
}

function bindEvents(){bind('loginBtn','click',login);bind('gpsBtn','click',getGPS);bind('submitRollcallBtn','click',submitRollcall);bind('driverLogoutBtn','click',()=>location.reload());bind('adminLogoutBtn','click',()=>location.reload());bind('exportCsvBtn','click',exportCSV);bind('printPdfBtn','click',()=>{showAdminTab('records');setTimeout(()=>window.print(),200)});bind('backupBtn','click',backupData);bind('restoreBtn','click',()=>$('restoreInput')?.click());bind('restoreInput','change',restoreData);bind('clearRecordsBtn','click',clearRecords);bind('notifyBtn','click',enableNotification);bind('addDriverBtn','click',addDriver);bind('addAdminBtn','click',addAdmin);bind('photoInput','change',previewPhoto);
bind('removePhotoBtn','click',removePhoto);document.querySelectorAll('.admin-nav button[data-tab]').forEach(b=>b.onclick=()=>showAdminTab(b.dataset.tab));$('driversBody')?.addEventListener('click',e=>{if(e.target.dataset.deleteDriver!==undefined)deleteDriver(+e.target.dataset.deleteDriver)});$('adminsBody')?.addEventListener('click',e=>{if(e.target.dataset.deleteAdmin!==undefined)deleteAdmin(+e.target.dataset.deleteAdmin)});}
function bind(id,ev,fn){const el=$(id);if(el)el.addEventListener(ev,fn)}
function renderCheckList(){const box=$('checkList');if(!box)return;box.innerHTML=CHECK_ITEMS.map(([id,l])=>`<div class="check"><label><input type="checkbox" id="${id}">${l}</label></div>`).join('')}
function enhanceSearchUI(){const tab=$('recordsTab');if(!tab||$('startDateSearch'))return;const grid=tab.querySelector('.grid.three');if(!grid)return;grid.innerHTML=`<div><label>ドライバー名</label><select id="driverSelectSearch"><option value="">全員</option></select></div><div><label>開始日</label><input id="startDateSearch" type="date"></div><div><label>終了日</label><input id="endDateSearch" type="date"></div><div><label>点呼区分</label><select id="typeSearch"><option value="">全部</option><option>乗務前点呼</option><option>乗務後点呼</option><option>中間点呼</option></select></div><div><label>判定</label><select id="statusSearch"><option value="">全部</option><option value="ok">OK</option><option value="need">要確認</option></select></div><div><label>担当コース</label><select id="courseSearch"><option value="">全部</option><option>Amazon</option><option>ヤマト</option><option>佐川</option><option>スポット便</option><option>その他</option></select></div><div><label>フリー検索</label><input id="driverSearch" placeholder="名前・車両・備考"></div><div><label>日付検索</label><input id="dateSearch" type="date"></div><div><label>簡易表示</label><select id="recordFilter"><option value="all">全期間</option><option value="today">今日のみ</option><option value="need">要確認のみ</option><option value="month">今月のみ</option></select></div>`;['driverSelectSearch','startDateSearch','endDateSearch','typeSearch','statusSearch','courseSearch','driverSearch','dateSearch','recordFilter'].forEach(id=>{bind(id,'change',renderRecords);bind(id,'input',renderRecords)});renderDriverOptions()}
function renderDriverOptions(){const s=$('driverSelectSearch');if(!s)return;const cur=s.value;const names=[...new Set(getDrivers().map(d=>d.name).filter(Boolean))];s.innerHTML='<option value="">全員</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');s.value=cur}
function login(){const type=$('loginType').value,name=$('loginName').value.trim(),pass=$('loginPassword').value.trim();if(!name||!pass){alert('名前とパスワードを入力してください');return}if(type==='admin'){const extra=getAdmins().some(a=>String(a.name).trim()===name&&String(a.pass).trim()===pass);if((name===ADMIN_ID&&pass===ADMIN_PASS)||extra){$('loginView').classList.add('hidden');$('adminView').classList.remove('hidden');showAdminTab('dashboard');return}alert('管理者IDまたはパスワードが違います');return}currentUser=name;if($('currentDriver'))$('currentDriver').textContent=`${name} さん`;const d=getDrivers().find(x=>x.name===name);if(d&&d.vehicle&&$('vehicleNo'))$('vehicleNo').value=d.vehicle;$('loginView').classList.add('hidden');$('driverView').classList.remove('hidden')}
function getGPS(){if(!navigator.geolocation){alert('GPS非対応です');return}$('gpsText').value='取得中...';navigator.geolocation.getCurrentPosition(p=>{gpsData={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,time:nowText()};$('gpsText').value=`緯度:${gpsData.lat.toFixed(6)} 経度:${gpsData.lng.toFixed(6)} 精度:${Math.round(gpsData.accuracy)}m`},()=>{gpsData=null;$('gpsText').value='取得失敗';alert('GPS取得に失敗しました。位置情報を許可してください。')},{enableHighAccuracy:true,timeout:10000,maximumAge:0})}
function previewPhoto(){const f=$('photoInput')?.files?.[0];if(!f){$('photoPreview')?.classList.add('hidden');return}const r=new FileReader();r.onload=()=>{$('photoPreview').src=r.result;$('photoPreview').classList.remove('hidden')};r.readAsDataURL(f)}
function removePhoto(silent=false){
  const input = $('photoInput');
  const preview = $('photoPreview');

  if(input) input.value = '';

  if(preview){
    preview.src = '';
    preview.classList.add('hidden');
  }

  if(!silent) alert('添付写真を削除しました');
}
function resizePhotoFile(file){
  return new Promise((resolve,reject)=>{
    if(!file){resolve('');return}
    if(!file.type.startsWith('image/')){alert('画像ファイルを選択してください');resolve('');return}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('写真の読み込みに失敗しました'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('写真の処理に失敗しました'));
      img.onload=()=>{
        const max=900;
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(img.width*scale);
        canvas.height=Math.round(img.height*scale);
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.72));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function detectCourse(){const t=(($('deliveryNote')?.value||'')+' '+($('remarks')?.value||''));if(t.includes('Amazon'))return'Amazon';if(t.includes('ヤマト'))return'ヤマト';if(t.includes('佐川'))return'佐川';if(t.includes('スポット'))return'スポット便';return''}
async function submitRollcall(){const checks={};CHECK_ITEMS.forEach(([id])=>checks[id]=!!$(id)?.checked);const allOk=CHECK_ITEMS.every(([id])=>checks[id]);if(!allOk&&!confirm('未チェック項目があります。要確認として送信しますか？'))return;const save=async photo=>{const rec={id:String(Date.now()),ok:allOk,time:nowText(),date:todayKey(),isoDate:isoDate(),month:monthKey(),driver:currentUser,name:currentUser,type:$('rollcallType')?.value||'',method:$('rollcallMethod')?.value||'',vehicleNo:$('vehicleNo')?.value.trim()||'',odometer:$('odometer')?.value.trim()||'',alcoholValue:$('alcoholValue')?.value.trim()||'',alcohol:$('alcoholValue')?.value.trim()||'',sleepHours:$('sleepHours')?.value.trim()||'',health:checks.healthGood?'良好':'要確認',instruction:$('instruction')?.value.trim()||'',deliveryNote:$('deliveryNote')?.value.trim()||'',course:detectCourse(),checks,gps:gpsData,photo:photo||'',remarks:$('remarks')?.value.trim()||'',createdAt:nowText()};const arr=getRecords();arr.unshift(rec);try{setLocal(LS_RECORDS,arr)}catch(e){alert('写真データが大きすぎて保存できません。添付写真を削除するか、別の小さい写真で送信してください。');return}await cloudSave('record',rec);alert(window.BELLE_CLOUD&&window.BELLE_CLOUD.enabled?'点呼を送信しました（クラウド同期済み）':'点呼を保存しました（ローカル保存）');removePhoto(true);};const f=$('photoInput')?.files?.[0];try{const photo=f?await resizePhotoFile(f):'';await save(photo)}catch(e){alert(e.message||'写真の処理に失敗しました。添付写真を削除して再送信してください。')}}
function showAdminTab(tab){document.querySelectorAll('.admin-tab').forEach(e=>e.classList.add('hidden'));$(`${tab}Tab`)?.classList.remove('hidden');if(tab==='dashboard')updateDashboard();if(tab==='records'){enhanceSearchUI();renderRecords()}if(tab==='drivers')renderDrivers();if(tab==='admins')renderAdmins()}
function updateDashboard(){const r=getRecords(),d=getDrivers();if($('statToday'))$('statToday').textContent=r.filter(x=>x.date===todayKey()).length;if($('statNeedCheck'))$('statNeedCheck').textContent=r.filter(x=>!x.ok).length;if($('statDrivers'))$('statDrivers').textContent=d.length;if($('statMonth'))$('statMonth').textContent=r.filter(x=>x.month===monthKey()).length;const names=new Set(r.filter(x=>x.date===todayKey()).map(x=>x.driver||x.name));const miss=d.filter(x=>!names.has(x.name)).map(x=>x.name);if($('missingToday'))$('missingToday').textContent=miss.length?miss.join('、'):'未点呼者はいません';drawChart()}
function drawChart(){const c=$('summaryChart');if(!c)return;const ctx=c.getContext('2d'),r=getRecords();ctx.clearRect(0,0,c.width,c.height);const vals=[r.filter(x=>x.date===todayKey()).length,r.filter(x=>x.month===monthKey()).length,r.filter(x=>!x.ok).length,getDrivers().length],labs=['今日','今月','要確認','登録'],max=Math.max(...vals,1);ctx.fillStyle='#071f3d';ctx.font='16px sans-serif';labs.forEach((l,i)=>{const h=vals[i]/max*160,x=60+i*120;ctx.fillRect(x,210-h,70,h);ctx.fillText(l,x,235);ctx.fillText(vals[i],x+24,200-h)})}
function filteredRecords(){let r=getRecords();const filter=$('recordFilter')?.value||'all',free=$('driverSearch')?.value.trim()||'',oldDate=$('dateSearch')?.value||'',driver=$('driverSelectSearch')?.value||'',start=$('startDateSearch')?.value||'',end=$('endDateSearch')?.value||'',type=$('typeSearch')?.value||'',status=$('statusSearch')?.value||'',course=$('courseSearch')?.value||'';if(filter==='today')r=r.filter(x=>x.date===todayKey());if(filter==='need')r=r.filter(x=>!x.ok);if(filter==='month')r=r.filter(x=>x.month===monthKey());if(driver)r=r.filter(x=>(x.driver||x.name||'')===driver);if(start)r=r.filter(x=>(x.isoDate||'')>=start);if(end)r=r.filter(x=>(x.isoDate||'')<=end);if(type)r=r.filter(x=>x.type===type);if(status==='ok')r=r.filter(x=>!!x.ok);if(status==='need')r=r.filter(x=>!x.ok);if(course)r=r.filter(x=>(x.course||x.deliveryNote||x.remarks||'').includes(course));if(free)r=r.filter(x=>[x.driver,x.name,x.vehicleNo,x.remarks,x.deliveryNote,x.instruction,x.course].some(v=>String(v||'').includes(free)));if(oldDate)r=r.filter(x=>x.isoDate===oldDate);return r}
function renderRecords(){const body=$('recordsBody');if(!body)return;const r=filteredRecords();if(!r.length){body.innerHTML='<tr><td colspan="9">履歴はありません</td></tr>';return}body.innerHTML=r.map(x=>{const checks=CHECK_ITEMS.map(([id,l])=>`${x.checks?.[id]?'✅':'❌'}${esc(l)}`).join('<br>');const gps=x.gps?`<a class="maplink" target="_blank" href="https://www.google.com/maps?q=${x.gps.lat},${x.gps.lng}">地図</a>`:'';return `<tr><td class="${x.ok?'status-ok':'status-ng'}">${x.ok?'OK':'要確認'}</td><td>${esc(x.time)}</td><td>${esc(x.type)}<br>${esc(x.course||'')}</td><td>${esc(x.driver||x.name)}</td><td>${esc(x.vehicleNo)}<br>${esc(x.odometer)}</td><td>${checks}<br>ALC:${esc(x.alcoholValue||x.alcohol)}<br>睡眠:${esc(x.sleepHours)}</td><td>${gps}</td><td>${x.photo?`<img class="photo" src="${x.photo}">`:''}</td><td>${esc(x.deliveryNote)}<br>${esc(x.remarks)}</td></tr>`}).join('')}
async function addDriver(){const name=$('newDriverName').value.trim();if(!name){alert('ドライバー名を入力してください');return}const d={id:String(Date.now()),name,tel:$('newDriverTel').value.trim(),license:$('newDriverLicense').value,vehicle:$('newDriverVehicle').value.trim(),memo:$('newDriverMemo').value.trim(),created:nowText(),createdAt:nowText()};const a=getDrivers().filter(x=>x.id!==d.id);a.unshift(d);setLocal(LS_DRIVERS,a);await cloudSave('driver',d);['newDriverName','newDriverTel','newDriverLicense','newDriverVehicle','newDriverMemo'].forEach(id=>{if($(id))$(id).value=''});renderDrivers();renderDriverOptions();updateDashboard()}
function renderDrivers(){const body=$('driversBody');if(!body)return;const d=getDrivers();if(!d.length){body.innerHTML='<tr><td colspan="7">登録ドライバーはありません</td></tr>';return}body.innerHTML=d.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.tel)}</td><td>${esc(x.license)}</td><td>${esc(x.vehicle)}</td><td>${esc(x.memo)}</td><td>${esc(x.created)}</td><td><button class="danger" data-delete-driver="${i}">削除</button></td></tr>`).join('')}
async function deleteDriver(i){if(!confirm('このドライバーを削除しますか？'))return;const a=getDrivers();const d=a[i];a.splice(i,1);setLocal(LS_DRIVERS,a);if(d&&d.id)await cloudDelete('driver',d.id);renderDrivers();renderDriverOptions();updateDashboard()}
async function addAdmin(){const name=$('newAdminId')?.value.trim()||'',pass=$('newAdminPass')?.value.trim()||'';if(!name||!pass){alert('管理者IDとパスワードを入力してください');return}const admin={id:name,name,pass,created:nowText(),createdAt:nowText()};const a=getAdmins().filter(x=>x.name!==name);a.push(admin);setLocal(LS_ADMINS,a);await cloudSave('admin',admin);if($('newAdminId'))$('newAdminId').value='';if($('newAdminPass'))$('newAdminPass').value='';renderAdmins()}
function renderAdmins(){const body=$('adminsBody');if(!body)return;const a=[{id:'admin',name:'admin',created:'初期管理者'},...getAdmins()];body.innerHTML=a.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.created)}</td><td>${x.id==='admin'?'削除不可':`<button class="danger" data-delete-admin="${i-1}">削除</button>`}</td></tr>`).join('')}
async function deleteAdmin(i){const a=getAdmins();const admin=a[i];a.splice(i,1);setLocal(LS_ADMINS,a);if(admin&&admin.id)await cloudDelete('admin',admin.id);renderAdmins()}
function exportCSV(){const rows=[['判定','日時','点呼区分','担当コース','名前','車両番号','メーター','アルコール','睡眠','GPS','備考']];filteredRecords().forEach(x=>rows.push([x.ok?'OK':'要確認',x.time,x.type,x.course||'',x.driver||x.name,x.vehicleNo,x.odometer,x.alcoholValue||x.alcohol,x.sleepHours,x.gps?`${x.gps.lat},${x.gps.lng}`:'',`${x.deliveryNote||''} ${x.remarks||''}`]));const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='belle-house-tenko-search-result.csv';a.click()}
function backupData(){const data={records:getRecords(),drivers:getDrivers(),admins:getAdmins(),created:nowText()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='belle-house-tenko-backup.json';a.click()}
function restoreData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(data.records)setLocal(LS_RECORDS,data.records);if(data.drivers)setLocal(LS_DRIVERS,data.drivers);if(data.admins)setLocal(LS_ADMINS,data.admins);alert('バックアップを読み込みました');location.reload()}catch{alert('読み込みに失敗しました')}};r.readAsText(f)}
async function enableNotification(){if(!('Notification'in window)){alert('この端末は通知非対応です');return}const p=await Notification.requestPermission();if(p!=='granted'){alert('通知が許可されませんでした');return}new Notification('BELLE HOUSE',{body:'点呼忘れ通知を有効にしました'})}
async function clearRecords(){if(!confirm('点呼履歴をすべて削除しますか？'))return;localStorage.removeItem(LS_RECORDS);if(window.BELLE_CLOUD&&window.BELLE_CLOUD.enabled&&window.BELLE_CLOUD.clearRecords){try{await window.BELLE_CLOUD.clearRecords()}catch(e){console.error(e);alert('クラウド側の削除に失敗しました。Firestoreルールを確認してください。')}}updateDashboard();renderRecords()}
setInterval(()=>{if(!cloudStarted)startCloudSync();updateSyncStatus();},3000);
document.addEventListener('DOMContentLoaded',init);
})();
