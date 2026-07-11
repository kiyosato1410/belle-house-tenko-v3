(function(){
'use strict';
const ADMIN_ID='admin',ADMIN_PASS='1234',LS_RECORDS='belle_house_tenko_v40_records',LS_DRIVERS='belle_house_tenko_v40_drivers',LS_ADMINS='belle_house_tenko_v40_admins',LS_SHIFTS='belle_house_tenko_v80_shifts',LS_DELETE_REQUESTS='belle_house_tenko_v82_delete_requests',LS_NOTICES='belle_house_tenko_v95_notices';
const APP_VERSION='Ver.9.5';
let currentUser='',gpsData=null;
let cloudStarted=false;
let cloudRetryCount=0;
let cloudLastError='';
const cloudUnsubs=[];
const SHIFT_COURSES=['真柴・滝沢','花泉・涌津','萩荘B・平泉','赤荻','徳田・黄海'];
let selectedShiftMonth='';
let selectedDriverShiftMonth='';
const CHECK_ITEMS=[['alcDevice','アルコール検知器を使用した'],['alcNone','酒気帯びなし'],['healthGood','疾病・疲労・睡眠不足なし'],['sleepOk','睡眠不足なし'],['licenseOk','運転免許証を携帯・有効確認'],['dailyInspection','日常点検を実施'],['vehicleOk','車両に異常なし'],['tireOk','タイヤ・灯火・ブレーキ確認'],['cargoOk','積荷・荷崩れ防止確認'],['overloadOk','過積載なし'],['restOk','休憩・拘束時間に無理なし'],['instructionOk','運行上の注意事項を確認']];
const $=id=>document.getElementById(id);const nowText=()=>new Date().toLocaleString('ja-JP',{hour12:false});const todayKey=()=>new Date().toLocaleDateString('ja-JP');const isoDate=()=>new Date().toISOString().slice(0,10);const monthKey=()=>new Date().toISOString().slice(0,7);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const getLocal=k=>JSON.parse(localStorage.getItem(k)||'[]');const setLocal=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const getRecords=()=>getLocal(LS_RECORDS);const getDrivers=()=>getLocal(LS_DRIVERS);const getAdmins=()=>getLocal(LS_ADMINS);const getDeleteRequests=()=>getLocal(LS_DELETE_REQUESTS);const getShifts=()=>getLocal(LS_SHIFTS);const getNotices=()=>getLocal(LS_NOTICES);
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
function getSortTimestamp(item){
  const value=item||{};
  for(const raw of [value.updatedAt,value.processedAt,value.createdAt,value.time]){
    if(raw==null||raw==='')continue;
    if(typeof raw==='number'&&Number.isFinite(raw))return raw;
    if(typeof raw==='object'){
      if(typeof raw.toMillis==='function'){const millis=raw.toMillis();if(Number.isFinite(millis))return millis}
      if(Number.isFinite(raw.seconds))return raw.seconds*1000;
    }
    const text=String(raw).trim();
    const match=text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if(match){
      const [,year,month,day,hour='0',minute='0',second='0']=match;
      return new Date(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute),Number(second)).getTime();
    }
    const parsed=Date.parse(text);
    if(Number.isFinite(parsed))return parsed;
  }
  const numericId=Number(value.id);
  return Number.isFinite(numericId)?numericId:0;
}
function sortByNewest(items){
  return [...(items||[])].sort((a,b)=>{
    const diff=getSortTimestamp(b)-getSortTimestamp(a);
    return diff!==0?diff:String(b?.id||'').localeCompare(String(a?.id||''));
  });
}
function refreshCurrentViews(){
  updateDashboard();
  renderDriverOptions();
  renderRecords();
  renderDrivers();
  renderAdmins();
  renderShifts();
  renderDeleteRequests();
  renderMonthlyShift();
  renderAdminNoticeDriverOptions();
  renderAdminNotices();
  if(currentUser){renderDriverHome();renderMyHistory();renderDriverMonthlyShift();renderDriverNotices();}
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
  if(cloud.onDeleteRequests){cloudUnsubs.push(cloud.onDeleteRequests(items=>{setLocal(LS_DELETE_REQUESTS,sortByNewest(items));refreshCurrentViews();}));}
  if(cloud.onShifts){cloudUnsubs.push(cloud.onShifts(shifts=>{setLocal(LS_SHIFTS,sortByNewest(shifts));refreshCurrentViews();}));}
  if(cloud.onNotices){cloudUnsubs.push(cloud.onNotices(items=>{setLocal(LS_NOTICES,sortByNewest(items));refreshCurrentViews();}));}
  uploadLocalDataToCloud();
}
async function uploadLocalDataToCloud(){
  const c=window.BELLE_CLOUD;
  if(!c||!c.enabled)return;
  try{
    for(const rec of getRecords()) if(rec&&rec.id&&c.saveRecord) await c.saveRecord(rec);
    for(const d of getDrivers()) if(d&&d.id&&c.saveDriver) await c.saveDriver(d);
    for(const a of getAdmins()) if(a&&a.id&&c.saveAdmin) await c.saveAdmin(a);
    for(const r of getDeleteRequests()) if(r&&r.id&&c.saveDeleteRequest) await c.saveDeleteRequest(r);
    for(const s of getShifts()) if(s&&s.id&&c.saveShift) await c.saveShift(s);
    for(const n of getNotices()) if(n&&n.id&&c.saveNotice) await c.saveNotice(n);
  }catch(e){console.warn('Local upload skipped',e)}
}
async function cloudSave(kind,data){
  const c=window.BELLE_CLOUD;
  if(!c||!c.enabled)return;
  try{
    if(kind==='record'&&c.saveRecord)await c.saveRecord(data);
    if(kind==='driver'&&c.saveDriver)await c.saveDriver(data);
    if(kind==='admin'&&c.saveAdmin)await c.saveAdmin(data);
    if(kind==='deleteRequest'&&c.saveDeleteRequest)await c.saveDeleteRequest(data);
    if(kind==='shift'&&c.saveShift)await c.saveShift(data);
    if(kind==='notice'&&c.saveNotice)await c.saveNotice(data);
  }catch(e){console.error('Cloud save error',e);alert('クラウド保存に失敗しました。通信状態またはFirestoreルールを確認してください。');}
}
async function cloudDelete(kind,id){
  const c=window.BELLE_CLOUD;
  if(!c||!c.enabled)return;
  try{
    if(kind==='driver'&&c.deleteDriver)await c.deleteDriver(String(id));
    if(kind==='admin'&&c.deleteAdmin)await c.deleteAdmin(String(id));
    if(kind==='shift'&&c.deleteShift)await c.deleteShift(String(id));
    if(kind==='notice'&&c.deleteNotice)await c.deleteNotice(String(id));
  }catch(e){console.error('Cloud delete error',e);alert('クラウド削除に失敗しました。通信状態またはFirestoreルールを確認してください。');}
}

function bindEvents(){bind('loginBtn','click',login);bind('gpsBtn','click',getGPS);bind('submitRollcallBtn','click',submitRollcall);bind('driverHomeBtn','click',()=>showDriverPanel('home'));bind('driverRollcallBtn','click',()=>showDriverPanel('rollcall'));bind('driverShiftBtn','click',()=>showDriverPanel('shift'));bind('driverHistoryBtn','click',()=>showDriverPanel('history'));bind('homeStartRollcallBtn','click',()=>showDriverPanel('rollcall'));bind('driverShiftMonth','change',()=>{selectedDriverShiftMonth=$('driverShiftMonth')?.value||monthKey();renderDriverMonthlyShift();});bind('driverPrevShiftMonthBtn','click',()=>changeDriverShiftMonth(-1));bind('driverNextShiftMonthBtn','click',()=>changeDriverShiftMonth(1));bind('driverCurrentShiftMonthBtn','click',()=>{selectedDriverShiftMonth=monthKey();if($('driverShiftMonth'))$('driverShiftMonth').value=selectedDriverShiftMonth;renderDriverMonthlyShift();});bind('myHistoryFilter','change',renderMyHistory);bind('myHistoryStart','change',renderMyHistory);bind('myHistoryEnd','change',renderMyHistory);bind('saveCommentBtn','click',saveAdminComment);bind('closeCommentBtn','click',closeCommentPanel);bind('recordsBody','click',handleRecordClick);bind('markCommentReadBtn','click',markCurrentDriverCommentsRead);bind('driverLogoutBtn','click',()=>location.reload());bind('adminLogoutBtn','click',()=>location.reload());bind('exportCsvBtn','click',exportCSV);bind('printPdfBtn','click',()=>{showAdminTab('records');setTimeout(()=>window.print(),200)});bind('backupBtn','click',backupData);bind('restoreBtn','click',()=>$('restoreInput')?.click());bind('restoreInput','change',restoreData);bind('clearRecordsBtn','click',clearRecords);bind('notifyBtn','click',enableNotification);bind('addDriverBtn','click',addDriver);bind('addAdminBtn','click',addAdmin);bind('photoInput','change',previewPhoto);
bind('removePhotoBtn','click',removePhoto);bind('sendNoticeBtn','click',sendAdminNotice);bind('adminNoticesList','click',handleAdminNoticeClick);bind('driverNoticesList','click',handleDriverNoticeClick);bind('shiftMonth','change',()=>{selectedShiftMonth=$('shiftMonth')?.value||monthKey();renderMonthlyShift();});bind('prevShiftMonthBtn','click',()=>changeShiftMonth(-1));bind('nextShiftMonthBtn','click',()=>changeShiftMonth(1));bind('currentShiftMonthBtn','click',()=>{selectedShiftMonth=monthKey();if($('shiftMonth'))$('shiftMonth').value=selectedShiftMonth;renderMonthlyShift();});bind('copyPrevMonthBtn','click',copyPreviousMonth);$('monthlyShiftBody')?.addEventListener('change',handleMonthlyShiftChange);document.querySelectorAll('.admin-nav button[data-tab]').forEach(b=>b.onclick=()=>showAdminTab(b.dataset.tab));$('driversBody')?.addEventListener('click',e=>{if(e.target.dataset.deleteDriver!==undefined)deleteDriver(+e.target.dataset.deleteDriver)});$('adminsBody')?.addEventListener('click',e=>{if(e.target.dataset.deleteAdmin!==undefined)deleteAdmin(+e.target.dataset.deleteAdmin)});$('deleteRequestsBody')?.addEventListener('click',handleDeleteRequestAdminClick);document.addEventListener('click',handleGlobalActionClick);}
function bind(id,ev,fn){const el=$(id);if(el)el.addEventListener(ev,fn)}
function renderCheckList(){const box=$('checkList');if(!box)return;box.innerHTML=CHECK_ITEMS.map(([id,l])=>`<div class="check"><label><input type="checkbox" id="${id}">${l}</label></div>`).join('')}
function enhanceSearchUI(){const tab=$('recordsTab');if(!tab||$('startDateSearch'))return;const grid=tab.querySelector('.grid.three');if(!grid)return;grid.innerHTML=`<div><label>ドライバー名</label><select id="driverSelectSearch"><option value="">全員</option></select></div><div><label>開始日</label><input id="startDateSearch" type="date"></div><div><label>終了日</label><input id="endDateSearch" type="date"></div><div><label>点呼区分</label><select id="typeSearch"><option value="">全部</option><option>乗務前点呼</option><option>乗務後点呼</option><option>中間点呼</option></select></div><div><label>判定</label><select id="statusSearch"><option value="">全部</option><option value="ok">OK</option><option value="need">要確認</option></select></div><div><label>担当コース</label><select id="courseSearch"><option value="">全部</option><option>Amazon</option><option>ヤマト</option><option>佐川</option><option>スポット便</option><option>その他</option></select></div><div><label>フリー検索</label><input id="driverSearch" placeholder="名前・車両・備考"></div><div><label>日付検索</label><input id="dateSearch" type="date"></div><div><label>簡易表示</label><select id="recordFilter"><option value="all">全期間</option><option value="today">今日のみ</option><option value="need">要確認のみ</option><option value="month">今月のみ</option></select></div>`;['driverSelectSearch','startDateSearch','endDateSearch','typeSearch','statusSearch','courseSearch','driverSearch','dateSearch','recordFilter'].forEach(id=>{bind(id,'change',renderRecords);bind(id,'input',renderRecords)});renderDriverOptions()}
function renderDriverOptions(){const s=$('driverSelectSearch');if(!s)return;const cur=s.value;const names=[...new Set(getDrivers().map(d=>d.name).filter(Boolean))];s.innerHTML='<option value="">全員</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');s.value=cur}
function login(){const type=$('loginType').value,name=$('loginName').value.trim(),pass=$('loginPassword').value.trim();if(!name||!pass){alert('名前とパスワードを入力してください');return}if(type==='admin'){const extra=getAdmins().some(a=>String(a.name).trim()===name&&String(a.pass).trim()===pass);if((name===ADMIN_ID&&pass===ADMIN_PASS)||extra){$('loginView').classList.add('hidden');$('adminView').classList.remove('hidden');showAdminTab('dashboard');return}alert('管理者IDまたはパスワードが違います');return}currentUser=name;if($('currentDriver'))$('currentDriver').textContent=`${name} さん、お疲れさまです`;const d=getDrivers().find(x=>x.name===name);if(d&&d.vehicle&&$('vehicleNo'))$('vehicleNo').value=d.vehicle;$('loginView').classList.add('hidden');$('driverView').classList.remove('hidden');showDriverPanel('home');renderDriverHome();renderDriverComments();renderMyHistory();renderDriverMonthlyShift();renderDriverNotices()}

function showDriverPanel(panel){
  const map={home:'driverHomePanel',rollcall:'driverRollcallPanel',shift:'driverShiftPanel',history:'driverHistoryPanel'};
  Object.values(map).forEach(id=>$(id)?.classList.add('hidden'));
  $(map[panel])?.classList.remove('hidden');
  const buttons={home:'driverHomeBtn',rollcall:'driverRollcallBtn',shift:'driverShiftBtn',history:'driverHistoryBtn'};
  Object.entries(buttons).forEach(([key,id])=>{const b=$(id);if(!b)return;b.className=key===panel?'primary':'secondary'});
  if(panel==='home')renderDriverHome();
  if(panel==='shift')renderDriverMonthlyShift();
  if(panel==='history')renderMyHistory();
}
function currentDriverRecords(){return getRecords().filter(r=>(r.driver||r.name)===currentUser&&r.deleted!==true)}

function updateDriverWorkdaySummary(targetMonth=monthKey()){
  if(!currentUser)return;
  const scheduledDates=[...new Set(getShifts()
    .filter(s=>s.date?.startsWith(targetMonth)&&s.driverName===currentUser&&s.status!=='休止')
    .map(s=>s.date)
    .filter(Boolean))];
  const attendanceDates=[...new Set(getRecords()
    .filter(r=>(r.driver||r.name)===currentUser&&(r.isoDate||'').startsWith(targetMonth)&&!r.deleted)
    .map(r=>r.isoDate)
    .filter(Boolean))];
  if($('driverMonthlyWorkdays'))$('driverMonthlyWorkdays').textContent=`${scheduledDates.length}日`;
  if($('driverMonthlyAttendanceDays'))$('driverMonthlyAttendanceDays').textContent=`${attendanceDates.length}日`;
}

function renderDriverHome(){
  if(!currentUser)return;
  const todayShifts=getShifts().filter(s=>s.date===isoDate()&&s.driverName===currentUser&&s.status==='出勤');
  const shift=todayShifts[0];
  if($('myShiftStatus'))$('myShiftStatus').textContent=todayShifts.length?'出勤':'未登録';
  if($('myShiftStatus'))$('myShiftStatus').className=todayShifts.length?'home-ok':'home-warn';
  const courses=todayShifts.map(s=>s.course||s.memo).filter(Boolean);
  if($('myShiftMemo'))$('myShiftMemo').textContent=courses.length?`担当：${courses.join('・')}`:'シフトのメモはありません';
  const today=currentDriverRecords().filter(r=>r.isoDate===isoDate());
  const before=sortByNewest(today.filter(r=>r.type==='乗務前点呼'))[0];
  const after=sortByNewest(today.filter(r=>r.type==='乗務後点呼'))[0];
  setDriverStatus('myBeforeStatus','myBeforeTime',before);
  setDriverStatus('myAfterStatus','myAfterTime',after);
}
function setDriverStatus(statusId,timeId,record){
  const status=$(statusId),time=$(timeId);if(!status||!time)return;
  if(!record){status.textContent='未実施';status.className='home-warn';time.textContent='';return}
  status.textContent=record.ok?'完了':'要確認';status.className=record.ok?'home-ok':'home-danger';time.textContent=record.time||'';
}
function myFilteredHistory(){
  let rows=currentDriverRecords();
  const filter=$('myHistoryFilter')?.value||'month',start=$('myHistoryStart')?.value||'',end=$('myHistoryEnd')?.value||'';
  if(start)rows=rows.filter(r=>(r.isoDate||'')>=start);
  if(end)rows=rows.filter(r=>(r.isoDate||'')<=end);
  if(!start&&!end){
    if(filter==='today')rows=rows.filter(r=>r.isoDate===isoDate());
    if(filter==='month')rows=rows.filter(r=>r.month===monthKey());
    if(filter==='week'){const d=new Date();d.setDate(d.getDate()-6);const min=d.toISOString().slice(0,10);rows=rows.filter(r=>(r.isoDate||'')>=min)}
  }
  return sortByNewest(rows);
}
function renderMyHistory(){
  const body=$('myHistoryBody');if(!body||!currentUser)return;
  const rows=myFilteredHistory();if($('myHistoryCount'))$('myHistoryCount').textContent=`${rows.length}件`;
  if(!rows.length){body.innerHTML='<tr><td colspan="6">該当する点呼記録はありません</td></tr>';return}
  body.innerHTML=rows.map(r=>{
    let action=`<button type="button" class="danger smallbtn" onclick="window.requestDeleteRecord(\'${esc(r.id)}\')">削除申請</button>`;
    if(r.deleteRequestStatus==='pending') action='<span class="request-pending">申請中</span>';
    if(r.deleteRequestStatus==='approved') action='<span class="request-approved">承認済み</span>';
    if(r.deleteRequestStatus==='rejected') action=`<span class="request-rejected">却下</span><br><button type="button" class="danger smallbtn" onclick="window.requestDeleteRecord(\'${esc(r.id)}\')">再申請</button>`;
    return `<tr><td>${esc(r.time)}</td><td>${esc(r.type)}</td><td class="${r.ok?'status-ok':'status-ng'}">${r.ok?'OK':'要確認'}</td><td>${esc(r.vehicleNo||'')}</td><td>${r.adminComment?`${esc(r.adminComment)}<br><span class="small">${r.commentRead?'確認済み':'未確認'}</span>`:'なし'}</td><td>${action}</td></tr>`;
  }).join('');
}
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
async function submitRollcall(){const selectedType=$('rollcallType')?.value||'';const duplicate=currentDriverRecords().find(r=>r.isoDate===isoDate()&&r.type===selectedType);if(duplicate){alert(`本日の${selectedType}は既に送信されています。自分の履歴から内容確認または削除申請をしてください。`);showDriverPanel('history');renderMyHistory();return}const checks={};CHECK_ITEMS.forEach(([id])=>checks[id]=!!$(id)?.checked);const allOk=CHECK_ITEMS.every(([id])=>checks[id]);if(!allOk&&!confirm('未チェック項目があります。要確認として送信しますか？'))return;const save=async photo=>{const rec={id:String(Date.now()),ok:allOk,time:nowText(),date:todayKey(),isoDate:isoDate(),month:monthKey(),driver:currentUser,name:currentUser,type:$('rollcallType')?.value||'',method:$('rollcallMethod')?.value||'',vehicleNo:$('vehicleNo')?.value.trim()||'',odometer:$('odometer')?.value.trim()||'',alcoholValue:$('alcoholValue')?.value.trim()||'',alcohol:$('alcoholValue')?.value.trim()||'',sleepHours:$('sleepHours')?.value.trim()||'',health:checks.healthGood?'良好':'要確認',instruction:$('instruction')?.value.trim()||'',deliveryNote:$('deliveryNote')?.value.trim()||'',course:detectCourse(),checks,gps:gpsData,photo:photo||'',remarks:$('remarks')?.value.trim()||'',createdAt:nowText()};const arr=getRecords();arr.unshift(rec);try{setLocal(LS_RECORDS,arr)}catch(e){alert('写真データが大きすぎて保存できません。添付写真を削除するか、別の小さい写真で送信してください。');return}await cloudSave('record',rec);alert(window.BELLE_CLOUD&&window.BELLE_CLOUD.enabled?'点呼を送信しました（クラウド同期済み）':'点呼を保存しました（ローカル保存）');removePhoto(true);renderDriverHome();renderMyHistory();showDriverPanel('home');};const f=$('photoInput')?.files?.[0];try{const photo=f?await resizePhotoFile(f):'';await save(photo)}catch(e){alert(e.message||'写真の処理に失敗しました。添付写真を削除して再送信してください。')}}
function showAdminTab(tab){document.querySelectorAll('.admin-tab').forEach(e=>e.classList.add('hidden'));$(`${tab}Tab`)?.classList.remove('hidden');if(tab==='dashboard')updateDashboard();if(tab==='records'){enhanceSearchUI();renderRecords()}if(tab==='drivers')renderDrivers();if(tab==='shifts'){initShiftTab();renderMonthlyShift()}if(tab==='admins')renderAdmins();if(tab==='deleteRequests')renderDeleteRequests();if(tab==='notices'){renderAdminNoticeDriverOptions();renderAdminNotices()}}
function updateDashboard(){const r=getRecords(),d=getDrivers(),s=getShifts();if($('statToday'))$('statToday').textContent=r.filter(x=>x.date===todayKey()).length;if($('statNeedCheck'))$('statNeedCheck').textContent=r.filter(x=>!x.ok).length;if($('statDrivers'))$('statDrivers').textContent=d.length;if($('statMonth'))$('statMonth').textContent=r.filter(x=>x.month===monthKey()).length;const today=isoDate();const scheduledNames=[...new Set(s.filter(x=>x.date===today&&x.status==='出勤'&&x.driverName).map(x=>x.driverName))];const names=new Set(r.filter(x=>x.isoDate===today||x.date===todayKey()).map(x=>x.driver||x.name));const miss=scheduledNames.filter(name=>!names.has(name));const unregistered=d.filter(x=>!scheduledNames.includes(x.name)).map(x=>x.name);if($('missingToday'))$('missingToday').innerHTML=miss.length?`<strong class="status-ng">未点呼：${miss.map(esc).join('、')}</strong>${unregistered.length?`<br><span class="small">シフト未登録：${unregistered.map(esc).join('、')}</span>`:''}`:`未点呼者はいません${unregistered.length?`<br><span class="small">シフト未登録：${unregistered.map(esc).join('、')}</span>`:''}`;drawChart()}
function drawChart(){const c=$('summaryChart');if(!c)return;const ctx=c.getContext('2d'),r=getRecords();ctx.clearRect(0,0,c.width,c.height);const vals=[r.filter(x=>x.date===todayKey()).length,r.filter(x=>x.month===monthKey()).length,r.filter(x=>!x.ok).length,getDrivers().length],labs=['今日','今月','要確認','登録'],max=Math.max(...vals,1);ctx.fillStyle='#071f3d';ctx.font='16px sans-serif';labs.forEach((l,i)=>{const h=vals[i]/max*160,x=60+i*120;ctx.fillRect(x,210-h,70,h);ctx.fillText(l,x,235);ctx.fillText(vals[i],x+24,200-h)})}
function filteredRecords(){let r=getRecords();const filter=$('recordFilter')?.value||'all',free=$('driverSearch')?.value.trim()||'',oldDate=$('dateSearch')?.value||'',driver=$('driverSelectSearch')?.value||'',start=$('startDateSearch')?.value||'',end=$('endDateSearch')?.value||'',type=$('typeSearch')?.value||'',status=$('statusSearch')?.value||'',course=$('courseSearch')?.value||'';if(filter==='today')r=r.filter(x=>x.date===todayKey());if(filter==='need')r=r.filter(x=>!x.ok);if(filter==='month')r=r.filter(x=>x.month===monthKey());if(driver)r=r.filter(x=>(x.driver||x.name||'')===driver);if(start)r=r.filter(x=>(x.isoDate||'')>=start);if(end)r=r.filter(x=>(x.isoDate||'')<=end);if(type)r=r.filter(x=>x.type===type);if(status==='ok')r=r.filter(x=>!!x.ok);if(status==='need')r=r.filter(x=>!x.ok);if(course)r=r.filter(x=>(x.course||x.deliveryNote||x.remarks||'').includes(course));if(free)r=r.filter(x=>[x.driver,x.name,x.vehicleNo,x.remarks,x.deliveryNote,x.instruction,x.course].some(v=>String(v||'').includes(free)));if(oldDate)r=r.filter(x=>x.isoDate===oldDate);return sortByNewest(r)}
function renderRecords(){const body=$('recordsBody');if(!body)return;const r=filteredRecords();if(!r.length){body.innerHTML='<tr><td colspan="9">履歴はありません</td></tr>';return}body.innerHTML=r.map(x=>{const checks=CHECK_ITEMS.map(([id,l])=>`${x.checks?.[id]?'✅':'❌'}${esc(l)}`).join('<br>');const gps=x.gps?`<a class="maplink" target="_blank" href="https://www.google.com/maps?q=${x.gps.lat},${x.gps.lng}">地図</a>`:'';return `<tr><td class="${x.ok?'status-ok':'status-ng'}">${x.ok?'OK':'要確認'}</td><td>${esc(x.time)}</td><td>${esc(x.type)}<br>${esc(x.course||'')}</td><td>${esc(x.driver||x.name)}</td><td>${esc(x.vehicleNo)}<br>${esc(x.odometer)}</td><td>${checks}<br>ALC:${esc(x.alcoholValue||x.alcohol)}<br>睡眠:${esc(x.sleepHours)}</td><td>${gps}</td><td>${x.photo?`<img class="photo" src="${x.photo}">`:''}</td><td>${esc(x.deliveryNote)}<br>${esc(x.remarks)}<br>${x.adminComment?`<div class="comment-status ${x.commentRead?'read':'unread'}">💬 ${x.commentRead?'既読':'未読'}：${esc(x.adminComment)}</div>`:'コメントなし'}<br><button class="secondary" data-comment-id="${esc(x.id)}">コメント</button></td></tr>`}).join('')}
async function addDriver(){const name=$('newDriverName').value.trim();if(!name){alert('ドライバー名を入力してください');return}const d={id:String(Date.now()),name,tel:$('newDriverTel').value.trim(),license:$('newDriverLicense').value,vehicle:$('newDriverVehicle').value.trim(),memo:$('newDriverMemo').value.trim(),created:nowText(),createdAt:nowText()};const a=getDrivers().filter(x=>x.id!==d.id);a.unshift(d);setLocal(LS_DRIVERS,a);await cloudSave('driver',d);['newDriverName','newDriverTel','newDriverLicense','newDriverVehicle','newDriverMemo'].forEach(id=>{if($(id))$(id).value=''});renderDrivers();renderDriverOptions();updateDashboard()}
function renderDrivers(){const body=$('driversBody');if(!body)return;const d=getDrivers();if(!d.length){body.innerHTML='<tr><td colspan="7">登録ドライバーはありません</td></tr>';return}body.innerHTML=d.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.tel)}</td><td>${esc(x.license)}</td><td>${esc(x.vehicle)}</td><td>${esc(x.memo)}</td><td>${esc(x.created)}</td><td><button class="danger" data-delete-driver="${i}">削除</button></td></tr>`).join('')}
async function deleteDriver(i){if(!confirm('このドライバーを削除しますか？'))return;const a=getDrivers();const d=a[i];a.splice(i,1);setLocal(LS_DRIVERS,a);if(d&&d.id)await cloudDelete('driver',d.id);renderDrivers();renderDriverOptions();updateDashboard()}
async function addAdmin(){const name=$('newAdminId')?.value.trim()||'',pass=$('newAdminPass')?.value.trim()||'';if(!name||!pass){alert('管理者IDとパスワードを入力してください');return}const admin={id:name,name,pass,created:nowText(),createdAt:nowText()};const a=getAdmins().filter(x=>x.name!==name);a.push(admin);setLocal(LS_ADMINS,a);await cloudSave('admin',admin);if($('newAdminId'))$('newAdminId').value='';if($('newAdminPass'))$('newAdminPass').value='';renderAdmins()}
function renderAdmins(){const body=$('adminsBody');if(!body)return;const a=[{id:'admin',name:'admin',created:'初期管理者'},...getAdmins()];body.innerHTML=a.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.created)}</td><td>${x.id==='admin'?'削除不可':`<button class="danger" data-delete-admin="${i-1}">削除</button>`}</td></tr>`).join('')}
async function deleteAdmin(i){const a=getAdmins();const admin=a[i];a.splice(i,1);setLocal(LS_ADMINS,a);if(admin&&admin.id)await cloudDelete('admin',admin.id);renderAdmins()}

function initShiftTab(){
  selectedShiftMonth=selectedShiftMonth||monthKey();
  if($('shiftMonth'))$('shiftMonth').value=selectedShiftMonth;
}
function monthParts(value){
  const [year,month]=String(value||monthKey()).split('-').map(Number);
  return {year,month};
}
function monthValue(year,month){
  const d=new Date(year,month-1,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function shiftDateFor(month,day){return `${month}-${String(day).padStart(2,'0')}`}
function courseShiftId(date,course){
  const safe=course.replace(/[^\p{L}\p{N}]+/gu,'-');
  return `${date}_course_${safe}`;
}
function changeShiftMonth(delta){
  const {year,month}=monthParts(selectedShiftMonth||monthKey());
  selectedShiftMonth=monthValue(year,month+delta);
  if($('shiftMonth'))$('shiftMonth').value=selectedShiftMonth;
  renderMonthlyShift();
}
function monthlyDriverChoices(selectedName){
  const names=getDrivers().map(d=>d.name).filter(Boolean);
  if(!names.includes('社長'))names.push('社長');
  const choices=['<option value="">未設定</option>','<option value="__CLOSED__">休止</option>'];
  names.forEach(name=>choices.push(`<option value="${esc(name)}" ${name===selectedName?'selected':''}>${esc(name)}</option>`));
  if(selectedName&&selectedName!=='休止'&&!names.includes(selectedName))choices.push(`<option value="${esc(selectedName)}" selected>${esc(selectedName)}</option>`);
  return choices.join('');
}

function changeDriverShiftMonth(delta){
  const base=selectedDriverShiftMonth||monthKey();
  const {year,month}=monthParts(base);
  selectedDriverShiftMonth=monthValue(year,month+delta);
  if($('driverShiftMonth'))$('driverShiftMonth').value=selectedDriverShiftMonth;
  renderDriverMonthlyShift();
}
function renderDriverMonthlyShift(){
  const head=$('driverMonthlyShiftHead'),body=$('driverMonthlyShiftBody');if(!head||!body||!currentUser)return;
  selectedDriverShiftMonth=$('driverShiftMonth')?.value||selectedDriverShiftMonth||monthKey();
  updateDriverWorkdaySummary(selectedDriverShiftMonth);
  if($('driverShiftMonth'))$('driverShiftMonth').value=selectedDriverShiftMonth;
  const {year,month}=monthParts(selectedDriverShiftMonth),days=new Date(year,month,0).getDate();
  const weekday=['日','月','火','水','木','金','土'];
  let header='<tr><th class="course-head">コース</th>';
  for(let day=1;day<=days;day++){
    const wd=new Date(year,month-1,day).getDay();
    header+=`<th class="day-head ${wd===0?'sun':wd===6?'sat':''}"><span>${day}</span><small>${weekday[wd]}</small></th>`;
  }
  head.innerHTML=header+'</tr>';
  const monthShifts=getShifts().filter(s=>s.date?.startsWith(selectedDriverShiftMonth)&&s.course);
  body.innerHTML=SHIFT_COURSES.map(course=>{
    let row=`<tr><th class="course-name">${esc(course)}</th>`;
    for(let day=1;day<=days;day++){
      const date=shiftDateFor(selectedDriverShiftMonth,day),wd=new Date(year,month-1,day).getDay();
      const shift=monthShifts.find(s=>s.date===date&&s.course===course);
      const isClosed=shift?.status==='休止';
      const driverName=isClosed?'休止':shift?.driverName||'';
      const isMine=driverName===currentUser;
      const cls=isClosed?'closed':isMine?'mine':driverName?'assigned':'';
      row+=`<td class="shift-cell readonly ${wd===0?'sun':wd===6?'sat':''} ${cls}" title="${esc(date)} ${esc(course)} ${esc(driverName||'未設定')}"><span>${esc(driverName||'')}</span></td>`;
    }
    return row+'</tr>';
  }).join('');
}

function renderMonthlyShift(){
  const head=$('monthlyShiftHead'),body=$('monthlyShiftBody');if(!head||!body)return;
  selectedShiftMonth=$('shiftMonth')?.value||selectedShiftMonth||monthKey();
  const {year,month}=monthParts(selectedShiftMonth),days=new Date(year,month,0).getDate();
  const weekday=['日','月','火','水','木','金','土'];
  let header='<tr><th class="course-head">コース</th>';
  for(let day=1;day<=days;day++){
    const wd=new Date(year,month-1,day).getDay();
    header+=`<th class="day-head ${wd===0?'sun':wd===6?'sat':''}"><span>${day}</span><small>${weekday[wd]}</small></th>`;
  }
  head.innerHTML=header+'</tr>';
  const monthShifts=getShifts().filter(s=>s.date?.startsWith(selectedShiftMonth)&&s.course);
  body.innerHTML=SHIFT_COURSES.map(course=>{
    let row=`<tr><th class="course-name">${esc(course)}</th>`;
    for(let day=1;day<=days;day++){
      const date=shiftDateFor(selectedShiftMonth,day),wd=new Date(year,month-1,day).getDay();
      const shift=monthShifts.find(s=>s.date===date&&s.course===course);
      const selected=shift?.status==='休止'?'休止':shift?.driverName||'';
      const cls=selected==='休止'?'closed':selected?'assigned':'';
      row+=`<td class="shift-cell ${wd===0?'sun':wd===6?'sat':''} ${cls}"><select data-shift-date="${date}" data-shift-course="${esc(course)}" aria-label="${date} ${esc(course)}">${monthlyDriverChoices(selected)}</select></td>`;
    }
    return row+'</tr>';
  }).join('');
  renderMonthlyShiftCounts();
}
async function handleMonthlyShiftChange(e){
  const select=e.target.closest('select[data-shift-date]');if(!select)return;
  const date=select.dataset.shiftDate,course=select.dataset.shiftCourse,value=select.value,id=courseShiftId(date,course);
  const shifts=getShifts().filter(s=>String(s.id)!==id);
  if(!value){
    setLocal(LS_SHIFTS,shifts);await cloudDelete('shift',id);setShiftSaveStatus('未設定に戻しました');renderMonthlyShift();updateDashboard();return;
  }
  const closed=value==='__CLOSED__';
  const driver=closed?null:getDrivers().find(d=>d.name===value);
  const shift={id,date,course,driverId:driver?String(driver.id):'',driverName:closed?'':value,status:closed?'休止':'出勤',memo:course,updatedAt:nowText(),createdAt:nowText()};
  shifts.unshift(shift);setLocal(LS_SHIFTS,shifts);await cloudSave('shift',shift);setShiftSaveStatus(`${date} ${course} を保存しました`);renderMonthlyShiftCounts();updateDashboard();renderDriverHome();
  select.closest('td')?.classList.toggle('closed',closed);select.closest('td')?.classList.toggle('assigned',!closed);
}
function setShiftSaveStatus(text){
  const el=$('shiftSaveStatus');if(!el)return;el.textContent=text;el.classList.add('saved');setTimeout(()=>{el.textContent='セルを変更すると自動保存されます';el.classList.remove('saved')},1800);
}
function renderMonthlyShiftCounts(){
  const box=$('monthlyShiftCounts');if(!box)return;
  const counts={};getShifts().filter(s=>s.date?.startsWith(selectedShiftMonth)&&s.course&&s.status==='出勤'&&s.driverName).forEach(s=>counts[s.driverName]=(counts[s.driverName]||0)+1);
  const names=[...new Set([...getDrivers().map(d=>d.name).filter(Boolean),...Object.keys(counts)])];
  box.innerHTML=names.length?names.map(name=>`<div class="shift-count-card"><strong>${esc(name)}</strong><span>${counts[name]||0}日</span></div>`).join(''):'<p class="small">ドライバーが登録されていません</p>';
}
async function copyPreviousMonth(){
  const {year,month}=monthParts(selectedShiftMonth||monthKey()),prev=monthValue(year,month-1);
  const source=getShifts().filter(s=>s.date?.startsWith(prev)&&s.course);
  if(!source.length){alert('前月にコピーできる配車がありません');return}
  if(!confirm(`${prev} の配車を ${selectedShiftMonth} へコピーしますか？\n現在月の同じコース・日付は上書きされます。`))return;
  const maxDays=new Date(year,month,0).getDate();let shifts=getShifts();let count=0;
  for(const s of source){
    const day=Number(s.date.slice(-2));if(day>maxDays)continue;
    const date=shiftDateFor(selectedShiftMonth,day),id=courseShiftId(date,s.course);
    const copy={...s,id,date,updatedAt:nowText(),createdAt:nowText()};
    shifts=shifts.filter(x=>String(x.id)!==id);shifts.unshift(copy);await cloudSave('shift',copy);count++;
  }
  setLocal(LS_SHIFTS,shifts);renderMonthlyShift();updateDashboard();alert(`${count}件の配車をコピーしました`);
}


function handleGlobalActionClick(e){
  const deleteBtn=e.target.closest?.('[data-request-delete]');
  if(deleteBtn){
    e.preventDefault();
    e.stopPropagation();
    createDeleteRequest(deleteBtn.dataset.requestDelete);
  }
}
function handleMyHistoryClick(e){
  const btn=e.target.closest('[data-request-delete]');if(!btn)return;
  createDeleteRequest(btn.dataset.requestDelete);
}
window.requestDeleteRecord = function(recordId){
  createDeleteRequest(recordId).catch(error=>{
    console.error('delete request error',error);
    alert('削除申請の処理中にエラーが発生しました。');
  });
};
async function createDeleteRequest(recordId){
  const records=getRecords();
  const rec=records.find(r=>String(r.id)===String(recordId));
  if(!rec||((rec.driver||rec.name)!==currentUser)){alert('対象記録が見つかりません');return}
  const existing=getDeleteRequests().find(r=>String(r.recordId)===String(recordId)&&r.status==='pending');
  if(existing){alert('この記録はすでに削除申請中です');return}
  const reason=prompt('削除理由を入力してください（例：二重送信、入力ミス）','二重送信');
  if(reason===null)return;
  if(!reason.trim()){alert('削除理由を入力してください');return}
  const request={id:String(Date.now()),recordId:String(rec.id),driver:currentUser,recordTime:rec.time,recordType:rec.type,reason:reason.trim(),status:'pending',createdAt:nowText()};
  const requests=getDeleteRequests();requests.unshift(request);setLocal(LS_DELETE_REQUESTS,requests);
  rec.deleteRequestStatus='pending';rec.deleteRequestId=request.id;setLocal(LS_RECORDS,records);
  await cloudSave('deleteRequest',request);await cloudSave('record',rec);
  alert('管理者へ削除申請を送りました');renderMyHistory();
}
function renderDeleteRequests(){
  const body=$('deleteRequestsBody');if(!body)return;
  const rows=sortByNewest(getDeleteRequests());
  const pending=rows.filter(r=>r.status==='pending').length;if($('deleteRequestCount'))$('deleteRequestCount').textContent=`未処理 ${pending}件`;
  if(!rows.length){body.innerHTML='<tr><td colspan="6">削除申請はありません</td></tr>';return}
  body.innerHTML=rows.map(r=>`<tr><td>${esc(r.createdAt)}</td><td>${esc(r.driver)}</td><td>${esc(r.recordTime)}<br>${esc(r.recordType)}</td><td>${esc(r.reason)}</td><td>${r.status==='pending'?'<span class="request-pending">申請中</span>':r.status==='approved'?'<span class="request-approved">承認済み</span>':'<span class="request-rejected">却下</span>'}</td><td>${r.status==='pending'?`<button class="success smallbtn" data-approve-request="${esc(r.id)}">承認</button> <button class="danger smallbtn" data-reject-request="${esc(r.id)}">却下</button>`:'処理済み'}</td></tr>`).join('');
}
function handleDeleteRequestAdminClick(e){
  const approve=e.target.closest('[data-approve-request]');const reject=e.target.closest('[data-reject-request]');
  if(approve)processDeleteRequest(approve.dataset.approveRequest,true);
  if(reject)processDeleteRequest(reject.dataset.rejectRequest,false);
}
async function processDeleteRequest(id,approved){
  const requests=getDeleteRequests();const req=requests.find(r=>String(r.id)===String(id));if(!req||req.status!=='pending')return;
  if(!confirm(approved?'この点呼記録を削除済みにしますか？':'この削除申請を却下しますか？'))return;
  req.status=approved?'approved':'rejected';req.processedAt=nowText();
  const records=getRecords();const rec=records.find(r=>String(r.id)===String(req.recordId));
  if(rec){rec.deleteRequestStatus=req.status;if(approved){rec.deleted=true;rec.deletedAt=nowText();rec.deletedReason=req.reason;rec.deletedBy='admin';}await cloudSave('record',rec);setLocal(LS_RECORDS,records)}
  setLocal(LS_DELETE_REQUESTS,requests);await cloudSave('deleteRequest',req);
  renderDeleteRequests();renderRecords();updateDashboard();alert(approved?'削除申請を承認しました':'削除申請を却下しました');
}


function noticeAudienceLabel(n){return n.audienceType==='all'?'全員':(n.targetDriver||'個別')}
function noticeIsForCurrentDriver(n){return n&&n.deleted!==true&&(n.audienceType==='all'||n.targetDriver===currentUser)}
function noticeReadBy(n,name){return Array.isArray(n.readBy)&&n.readBy.includes(name)}
function renderAdminNoticeDriverOptions(){
  const select=$('noticeTarget');if(!select)return;
  const current=select.value;
  const names=[...new Set(getDrivers().map(d=>d.name).filter(Boolean))];
  select.innerHTML='<option value="__ALL__">全員へ連絡</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}さんへ個別連絡</option>`).join('');
  if([...select.options].some(o=>o.value===current))select.value=current;
}
async function sendAdminNotice(){
  const target=$('noticeTarget')?.value||'__ALL__';
  const subject=$('noticeSubject')?.value.trim()||'';
  const message=$('noticeMessage')?.value.trim()||'';
  const priority=$('noticePriority')?.value||'normal';
  if(!subject){alert('件名を入力してください');return}
  if(!message){alert('連絡内容を入力してください');return}
  const notice={id:String(Date.now()),audienceType:target==='__ALL__'?'all':'individual',targetDriver:target==='__ALL__'?'':target,subject,message,priority,from:'管理者',readBy:[],createdAt:nowText(),isoDate:isoDate(),deleted:false};
  const notices=getNotices();notices.unshift(notice);setLocal(LS_NOTICES,notices);
  await cloudSave('notice',notice);
  $('noticeSubject').value='';$('noticeMessage').value='';$('noticePriority').value='normal';
  renderAdminNotices();renderDriverNotices();
  alert(target==='__ALL__'?'全員へ連絡事項を送信しました':'個別の連絡事項を送信しました');
}
function renderAdminNotices(){
  const box=$('adminNoticesList');if(!box)return;
  const notices=sortByNewest(getNotices().filter(n=>n.deleted!==true));
  if($('adminNoticeCount'))$('adminNoticeCount').textContent=`送信履歴 ${notices.length}件`;
  if(!notices.length){box.innerHTML='<p class="small">送信した連絡事項はありません</p>';return}
  const driverNames=[...new Set(getDrivers().map(d=>d.name).filter(Boolean))];
  box.innerHTML=notices.map(n=>{
    const targets=n.audienceType==='all'?driverNames:[n.targetDriver].filter(Boolean);
    const readBy=Array.isArray(n.readBy)?n.readBy:[];
    const unread=targets.filter(name=>!readBy.includes(name));
    const status=n.audienceType==='all'?`確認済み ${readBy.filter(name=>targets.includes(name)).length}/${targets.length}人`:(readBy.includes(n.targetDriver)?'確認済み':'未確認');
    const detail=n.audienceType==='all'&&targets.length?`<details><summary>確認状況を見る</summary><div class="notice-read-list">${targets.map(name=>`<span>${readBy.includes(name)?'✅':'⬜'} ${esc(name)}</span>`).join('')}</div></details>`:'';
    return `<article class="notice-card ${n.priority==='urgent'?'urgent':''}"><div class="notice-card-head"><div><strong>${n.priority==='urgent'?'🚨 ':''}${esc(n.subject)}</strong><br><span class="small">宛先：${esc(noticeAudienceLabel(n))}　${esc(n.createdAt)}</span></div><button type="button" class="danger smallbtn" data-delete-notice="${esc(n.id)}">削除</button></div><p class="notice-message">${esc(n.message).replace(/\n/g,'<br>')}</p><div class="small">${esc(status)}${unread.length&&n.audienceType==='all'?` ／ 未確認：${unread.map(esc).join('、')}`:''}</div>${detail}</article>`;
  }).join('');
}
function renderDriverNotices(){
  const box=$('driverNoticeBox');if(!box||!currentUser)return;
  const notices=sortByNewest(getNotices().filter(noticeIsForCurrentDriver));
  const recordComments=sortByNewest(getRecords().filter(r=>(r.driver||r.name)===currentUser&&r.adminComment&&!r.commentRead));
  if(!notices.length&&!recordComments.length){box.classList.add('hidden');box.innerHTML='';return}
  box.classList.remove('hidden');
  const unreadNotices=notices.filter(n=>!noticeReadBy(n,currentUser));
  let html=`<h3>🔔 管理者からのお知らせ${unreadNotices.length?`（未確認 ${unreadNotices.length}件）`:''}</h3>`;
  html+=notices.map(n=>{const read=noticeReadBy(n,currentUser);return `<article class="driver-notice-item ${n.priority==='urgent'?'urgent':''}"><div><strong>${n.priority==='urgent'?'🚨 緊急連絡':'📢 '+esc(n.subject)}</strong></div><div class="small">${n.audienceType==='all'?'全員連絡':'個別連絡'} ／ ${esc(n.createdAt)}</div><p>${esc(n.message).replace(/\n/g,'<br>')}</p><button type="button" class="${read?'secondary':'success'} smallbtn" data-read-notice="${esc(n.id)}" ${read?'disabled':''}>${read?'確認済み':'確認しました'}</button></article>`}).join('');
  if(recordComments.length)html+='<h4>点呼記録へのコメント</h4>'+recordComments.slice(0,5).map(r=>`<div class="driver-notice-item"><strong>${esc(r.time)}</strong><br>${esc(r.adminComment)}</div>`).join('')+'<button id="markCommentReadBtn" type="button" class="success">点呼コメントを確認しました</button>';
  box.innerHTML=html;bind('markCommentReadBtn','click',markCurrentDriverCommentsRead);
}
async function markNoticeRead(id){
  const notices=getNotices();const notice=notices.find(n=>String(n.id)===String(id));if(!notice||!currentUser)return;
  const readBy=Array.isArray(notice.readBy)?notice.readBy:[];if(!readBy.includes(currentUser))readBy.push(currentUser);
  notice.readBy=readBy;notice.lastReadAt=nowText();setLocal(LS_NOTICES,notices);await cloudSave('notice',notice);renderDriverNotices();renderAdminNotices();
}
async function deleteNotice(id){
  const notices=getNotices();const notice=notices.find(n=>String(n.id)===String(id));if(!notice)return;
  if(!confirm(`「${notice.subject||'連絡事項'}」を削除しますか？`))return;
  notice.deleted=true;notice.deletedAt=nowText();setLocal(LS_NOTICES,notices);await cloudSave('notice',notice);renderAdminNotices();renderDriverNotices();
}
function handleAdminNoticeClick(e){const btn=e.target.closest?.('[data-delete-notice]');if(btn)deleteNotice(btn.dataset.deleteNotice)}
function handleDriverNoticeClick(e){const btn=e.target.closest?.('[data-read-notice]');if(btn)markNoticeRead(btn.dataset.readNotice)}

function exportCSV(){const rows=[['判定','日時','点呼区分','担当コース','名前','車両番号','メーター','アルコール','睡眠','GPS','備考']];filteredRecords().forEach(x=>rows.push([x.ok?'OK':'要確認',x.time,x.type,x.course||'',x.driver||x.name,x.vehicleNo,x.odometer,x.alcoholValue||x.alcohol,x.sleepHours,x.gps?`${x.gps.lat},${x.gps.lng}`:'',`${x.deliveryNote||''} ${x.remarks||''}`]));const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='belle-house-tenko-search-result.csv';a.click()}
function backupData(){const data={records:getRecords(),drivers:getDrivers(),admins:getAdmins(),shifts:getShifts(),deleteRequests:getDeleteRequests(),notices:getNotices(),created:nowText()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='belle-house-tenko-backup.json';a.click()}
function restoreData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(data.records)setLocal(LS_RECORDS,data.records);if(data.drivers)setLocal(LS_DRIVERS,data.drivers);if(data.admins)setLocal(LS_ADMINS,data.admins);if(data.shifts)setLocal(LS_SHIFTS,data.shifts);if(data.deleteRequests)setLocal(LS_DELETE_REQUESTS,data.deleteRequests);if(data.notices)setLocal(LS_NOTICES,data.notices);alert('バックアップを読み込みました');location.reload()}catch{alert('読み込みに失敗しました')}};r.readAsText(f)}
async function enableNotification(){if(!('Notification'in window)){alert('この端末は通知非対応です');return}const p=await Notification.requestPermission();if(p!=='granted'){alert('通知が許可されませんでした');return}new Notification('BELLE HOUSE',{body:'点呼忘れ通知を有効にしました'})}
async function clearRecords(){if(!confirm('点呼履歴をすべて削除しますか？'))return;localStorage.removeItem(LS_RECORDS);if(window.BELLE_CLOUD&&window.BELLE_CLOUD.enabled&&window.BELLE_CLOUD.clearRecords){try{await window.BELLE_CLOUD.clearRecords()}catch(e){console.error(e);alert('クラウド側の削除に失敗しました。Firestoreルールを確認してください。')}}updateDashboard();renderRecords()}
setInterval(()=>{if(!cloudStarted)startCloudSync();updateSyncStatus();},3000);

let selectedCommentRecordId = null;

function handleRecordClick(e){
  const btn = e.target.closest('[data-comment-id]');
  if(!btn) return;
  selectedCommentRecordId = btn.dataset.commentId;
  const rec = getRecords().find(x => String(x.id) === String(selectedCommentRecordId));
  if(!rec) return;
  if($('commentTarget')) $('commentTarget').textContent = `${rec.driver || rec.name} / ${rec.time}`;
  if($('adminCommentText')) $('adminCommentText').value = rec.adminComment || '';
  $('commentPanel')?.classList.remove('hidden');
}

function closeCommentPanel(){
  selectedCommentRecordId = null;
  $('commentPanel')?.classList.add('hidden');
}

async function saveAdminComment(){
  if(!selectedCommentRecordId){
    alert('コメント対象の点呼記録を選択してください');
    return;
  }
  const text = $('adminCommentText')?.value.trim() || '';
  const records = getRecords();
  const rec = records.find(x => String(x.id) === String(selectedCommentRecordId));
  if(!rec){
    alert('対象の点呼記録が見つかりません');
    return;
  }
  rec.adminComment = text;
  rec.commentRead = false;
  rec.commentUpdatedAt = nowText();
  setLocal(LS_RECORDS, records);
  await cloudSave('record', rec);
  alert('管理者コメントを保存しました');
  closeCommentPanel();
  renderRecords();
  updateDashboard();
}

function renderDriverComments(){renderDriverNotices()}

async function markCurrentDriverCommentsRead(){
  const records = getRecords();
  const targets = records.filter(r => (r.driver || r.name) === currentUser && r.adminComment && !r.commentRead);
  if(!targets.length) return;
  for(const rec of targets){
    rec.commentRead = true;
    rec.commentReadAt = nowText();
    await cloudSave('record', rec);
  }
  setLocal(LS_RECORDS, records);
  alert('確認済みにしました');
  renderDriverComments();
}

document.addEventListener('DOMContentLoaded',init);
})();
