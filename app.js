
(function(){
'use strict';

const ADMIN_ID = 'admin';
const ADMIN_PASS = '1234';
const LS_RECORDS = 'belle_house_tenko_v40_records';
const LS_DRIVERS = 'belle_house_tenko_v40_drivers';
const LS_ADMINS = 'belle_house_tenko_v40_admins';

let currentUser = '';
let gpsData = null;

const CHECK_ITEMS = [
  ['alcDevice','アルコール検知器を使用した'],
  ['alcNone','酒気帯びなし'],
  ['healthGood','疾病・疲労・睡眠不足なし'],
  ['sleepOk','睡眠不足なし'],
  ['licenseOk','運転免許証を携帯・有効確認'],
  ['dailyInspection','日常点検を実施'],
  ['vehicleOk','車両に異常なし'],
  ['tireOk','タイヤ・灯火・ブレーキ確認'],
  ['cargoOk','積荷・荷崩れ防止確認'],
  ['overloadOk','過積載なし'],
  ['restOk','休憩・拘束時間に無理なし'],
  ['instructionOk','運行上の注意事項を確認']
];

const $ = id => document.getElementById(id);
const nowText = () => new Date().toLocaleString('ja-JP',{hour12:false});
const todayKey = () => new Date().toLocaleDateString('ja-JP');
const isoDate = () => new Date().toISOString().slice(0,10);
const monthKey = () => new Date().toISOString().slice(0,7);
const getLocal = key => JSON.parse(localStorage.getItem(key) || '[]');
const setLocal = (key,val) => localStorage.setItem(key, JSON.stringify(val));
const getRecords = () => getLocal(LS_RECORDS);
const setRecords = v => setLocal(LS_RECORDS, v);
const getDrivers = () => getLocal(LS_DRIVERS);
const setDrivers = v => setLocal(LS_DRIVERS, v);
const getAdmins = () => getLocal(LS_ADMINS);
const setAdmins = v => setLocal(LS_ADMINS, v);
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function init(){
  const sync = $('syncStatus');
  if(sync) sync.textContent = window.BELLE_FIREBASE_CONFIG && window.BELLE_FIREBASE_CONFIG.apiKey ? 'Firebase設定済み' : 'ローカル保存';
  renderCheckList();
  bindEvents();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

function bindEvents(){
  safeBind('loginBtn','click',login);
  safeBind('gpsBtn','click',getGPS);
  safeBind('submitRollcallBtn','click',submitRollcall);
  safeBind('driverLogoutBtn','click',()=>location.reload());
  safeBind('adminLogoutBtn','click',()=>location.reload());
  safeBind('exportCsvBtn','click',exportCSV);
  safeBind('printPdfBtn','click',()=>window.print());
  safeBind('backupBtn','click',backupData);
  safeBind('restoreBtn','click',()=>$('restoreInput')?.click());
  safeBind('restoreInput','change',restoreData);
  safeBind('clearRecordsBtn','click',clearRecords);
  safeBind('notifyBtn','click',enableNotification);
  safeBind('addDriverBtn','click',addDriver);
  safeBind('addAdminBtn','click',addAdmin);
  safeBind('recordFilter','change',renderRecords);
  safeBind('driverSearch','input',renderRecords);
  safeBind('dateSearch','change',renderRecords);
  safeBind('photoInput','change',previewPhoto);

  document.querySelectorAll('.admin-nav button[data-tab]').forEach(btn=>{
    btn.addEventListener('click',()=>showAdminTab(btn.dataset.tab));
  });

  const driversBody = $('driversBody');
  if(driversBody) driversBody.addEventListener('click',e=>{
    if(e.target.dataset.deleteDriver !== undefined) deleteDriver(Number(e.target.dataset.deleteDriver));
  });

  const adminsBody = $('adminsBody');
  if(adminsBody) adminsBody.addEventListener('click',e=>{
    if(e.target.dataset.deleteAdmin !== undefined) deleteAdmin(Number(e.target.dataset.deleteAdmin));
  });
}

function safeBind(id,event,fn){
  const el = $(id);
  if(el) el.addEventListener(event,fn);
}

function renderCheckList(){
  const box = $('checkList');
  if(!box) return;
  box.innerHTML = CHECK_ITEMS.map(([id,label]) =>
    `<div class="check"><label><input type="checkbox" id="${id}">${label}</label></div>`
  ).join('');
}

function login(){
  try{
    const type = $('loginType').value;
    const name = $('loginName').value.trim();
    const pass = $('loginPassword').value.trim();

    if(!name || !pass){
      alert('名前とパスワードを入力してください');
      return;
    }

    if(type === 'admin'){
      const extraAdmin = getAdmins().some(a => String(a.name).trim() === name && String(a.pass).trim() === pass);
      if((name === ADMIN_ID && pass === ADMIN_PASS) || extraAdmin){
        $('loginView').classList.add('hidden');
        $('adminView').classList.remove('hidden');
        showAdminTab('dashboard');
        return;
      }
      alert('管理者IDまたはパスワードが違います');
      return;
    }

    currentUser = name;
    if($('currentDriver')) $('currentDriver').textContent = `${name} さん`;
    const driver = getDrivers().find(d => d.name === name);
    if(driver && driver.vehicle && $('vehicleNo')) $('vehicleNo').value = driver.vehicle;
    $('loginView').classList.add('hidden');
    $('driverView').classList.remove('hidden');
  }catch(e){
    alert('ログインエラー: ' + e.message);
  }
}

function getGPS(){
  if(!navigator.geolocation){ alert('GPS非対応です'); return; }
  $('gpsText').value = '取得中...';
  navigator.geolocation.getCurrentPosition(p=>{
    gpsData = {lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,time:nowText()};
    $('gpsText').value = `緯度:${gpsData.lat.toFixed(6)} 経度:${gpsData.lng.toFixed(6)} 精度:${Math.round(gpsData.accuracy)}m`;
  },()=>{
    gpsData = null;
    $('gpsText').value = '取得失敗';
    alert('GPS取得に失敗しました。位置情報を許可してください。');
  },{enableHighAccuracy:true,timeout:10000,maximumAge:0});
}

function previewPhoto(){
  const f = $('photoInput')?.files?.[0];
  if(!f){ $('photoPreview')?.classList.add('hidden'); return; }
  const r = new FileReader();
  r.onload = () => {
    $('photoPreview').src = r.result;
    $('photoPreview').classList.remove('hidden');
  };
  r.readAsDataURL(f);
}

function submitRollcall(){
  const checks = {};
  CHECK_ITEMS.forEach(([id])=> checks[id] = !!$(id)?.checked);
  const allOk = CHECK_ITEMS.every(([id])=>checks[id]);
  if(!allOk && !confirm('未チェック項目があります。要確認として送信しますか？')) return;

  const save = photo => {
    const rec = {
      id:String(Date.now()), ok:allOk, time:nowText(), date:todayKey(), isoDate:isoDate(), month:monthKey(),
      driver:currentUser, type:$('rollcallType')?.value || '', method:$('rollcallMethod')?.value || '',
      vehicleNo:$('vehicleNo')?.value.trim() || '', odometer:$('odometer')?.value.trim() || '',
      alcoholValue:$('alcoholValue')?.value.trim() || '', sleepHours:$('sleepHours')?.value.trim() || '',
      instruction:$('instruction')?.value.trim() || '', deliveryNote:$('deliveryNote')?.value.trim() || '',
      checks, gps:gpsData, photo:photo || '', remarks:$('remarks')?.value.trim() || ''
    };
    const records = getRecords();
    records.unshift(rec);
    setRecords(records);
    alert('点呼を送信しました');
  };

  const f = $('photoInput')?.files?.[0];
  if(f){
    const r = new FileReader();
    r.onload = () => save(r.result);
    r.readAsDataURL(f);
  }else{
    save('');
  }
}

function showAdminTab(tab){
  document.querySelectorAll('.admin-tab').forEach(el=>el.classList.add('hidden'));
  const target = $(`${tab}Tab`);
  if(target) target.classList.remove('hidden');
  if(tab === 'dashboard') updateDashboard();
  if(tab === 'records') renderRecords();
  if(tab === 'drivers') renderDrivers();
  if(tab === 'admins') renderAdmins();
}

function updateDashboard(){
  const records = getRecords();
  const drivers = getDrivers();
  if($('statToday')) $('statToday').textContent = records.filter(r=>r.date===todayKey()).length;
  if($('statNeedCheck')) $('statNeedCheck').textContent = records.filter(r=>!r.ok).length;
  if($('statDrivers')) $('statDrivers').textContent = drivers.length;
  if($('statMonth')) $('statMonth').textContent = records.filter(r=>r.month===monthKey()).length;
  const todayNames = new Set(records.filter(r=>r.date===todayKey()).map(r=>r.driver));
  const missing = drivers.filter(d=>!todayNames.has(d.name)).map(d=>d.name);
  if($('missingToday')) $('missingToday').textContent = missing.length ? missing.join('、') : '未点呼者はいません';
  drawChart();
}

function drawChart(){
  const c = $('summaryChart');
  if(!c) return;
  const ctx = c.getContext('2d');
  const records = getRecords();
  ctx.clearRect(0,0,c.width,c.height);
  const vals = [records.filter(r=>r.date===todayKey()).length, records.filter(r=>r.month===monthKey()).length, records.filter(r=>!r.ok).length, getDrivers().length];
  const labels = ['今日','今月','要確認','登録'];
  const max = Math.max(...vals,1);
  ctx.fillStyle = '#071f3d';
  ctx.font = '16px sans-serif';
  labels.forEach((l,i)=>{
    const h = (vals[i]/max)*160;
    const x = 60 + i*120;
    ctx.fillRect(x,210-h,70,h);
    ctx.fillText(l,x,235);
    ctx.fillText(vals[i],x+24,200-h);
  });
}

function filteredRecords(){
  let records = getRecords();
  const f = $('recordFilter')?.value || 'today';
  const s = $('driverSearch')?.value.trim() || '';
  const d = $('dateSearch')?.value || '';
  if(f==='today') records = records.filter(r=>r.date===todayKey());
  if(f==='need') records = records.filter(r=>!r.ok);
  if(f==='month') records = records.filter(r=>r.month===monthKey());
  if(s) records = records.filter(r=>(r.driver||'').includes(s));
  if(d) records = records.filter(r=>r.isoDate===d);
  return records;
}

function renderRecords(){
  const body = $('recordsBody');
  if(!body) return;
  const records = filteredRecords();
  if(!records.length){ body.innerHTML = '<tr><td colspan="9">履歴はありません</td></tr>'; return; }
  body.innerHTML = records.map(r=>{
    const checks = CHECK_ITEMS.map(([id,l])=>`${r.checks?.[id]?'✅':'❌'}${esc(l)}`).join('<br>');
    const gps = r.gps ? `<a class="maplink" target="_blank" href="https://www.google.com/maps?q=${r.gps.lat},${r.gps.lng}">地図</a>` : '';
    return `<tr><td class="${r.ok?'status-ok':'status-ng'}">${r.ok?'OK':'要確認'}</td><td>${esc(r.time)}</td><td>${esc(r.type)}</td><td>${esc(r.driver)}</td><td>${esc(r.vehicleNo)}<br>${esc(r.odometer)}</td><td>${checks}<br>ALC:${esc(r.alcoholValue)}<br>睡眠:${esc(r.sleepHours)}</td><td>${gps}</td><td>${r.photo?`<img class="photo" src="${r.photo}">`:''}</td><td>${esc(r.remarks)}</td></tr>`;
  }).join('');
}

function addDriver(){
  const name = $('newDriverName').value.trim();
  if(!name){ alert('ドライバー名を入力してください'); return; }
  const d = {id:String(Date.now()),name,tel:$('newDriverTel').value.trim(),license:$('newDriverLicense').value,vehicle:$('newDriverVehicle').value.trim(),memo:$('newDriverMemo').value.trim(),created:nowText()};
  const arr = getDrivers();
  arr.unshift(d);
  setDrivers(arr);
  renderDrivers();
  updateDashboard();
}

function renderDrivers(){
  const body = $('driversBody');
  if(!body) return;
  const drivers = getDrivers();
  if(!drivers.length){ body.innerHTML = '<tr><td colspan="7">登録ドライバーはありません</td></tr>'; return; }
  body.innerHTML = drivers.map((d,i)=>`<tr><td>${esc(d.name)}</td><td>${esc(d.tel)}</td><td>${esc(d.license)}</td><td>${esc(d.vehicle)}</td><td>${esc(d.memo)}</td><td>${esc(d.created)}</td><td><button class="danger" data-delete-driver="${i}">削除</button></td></tr>`).join('');
}

function deleteDriver(i){
  if(!confirm('このドライバーを削除しますか？')) return;
  const arr = getDrivers();
  arr.splice(i,1);
  setDrivers(arr);
  renderDrivers();
  updateDashboard();
}

function addAdmin(){
  const name = $('newAdminId').value.trim();
  const pass = $('newAdminPass').value.trim();
  if(!name || !pass){ alert('管理者IDとパスワードを入力してください'); return; }
  const arr = getAdmins().filter(a=>a.name!==name);
  arr.push({id:name,name,pass,created:nowText()});
  setAdmins(arr);
  renderAdmins();
}

function renderAdmins(){
  const body = $('adminsBody');
  if(!body) return;
  const admins = [{id:'admin',name:'admin',created:'初期管理者'},...getAdmins()];
  body.innerHTML = admins.map((a,i)=>`<tr><td>${esc(a.name)}</td><td>${esc(a.created)}</td><td>${a.id==='admin'?'削除不可':`<button class="danger" data-delete-admin="${i-1}">削除</button>`}</td></tr>`).join('');
}

function deleteAdmin(i){
  const arr = getAdmins();
  arr.splice(i,1);
  setAdmins(arr);
  renderAdmins();
}

function exportCSV(){
  const rows = [['判定','日時','点呼区分','名前','車両番号','アルコール','GPS','備考']];
  filteredRecords().forEach(r=>rows.push([r.ok?'OK':'要確認',r.time,r.type,r.driver,r.vehicleNo,r.alcoholValue,r.gps?`${r.gps.lat},${r.gps.lng}`:'',r.remarks]));
  const csv = rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'belle-house-tenko-loginfix.csv';
  a.click();
}

function backupData(){
  const data = {records:getRecords(),drivers:getDrivers(),admins:getAdmins(),created:nowText()};
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'belle-house-tenko-backup.json';
  a.click();
}

function restoreData(e){
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const data = JSON.parse(r.result);
      if(data.records) setRecords(data.records);
      if(data.drivers) setDrivers(data.drivers);
      if(data.admins) setAdmins(data.admins);
      alert('バックアップを読み込みました');
      location.reload();
    }catch{
      alert('読み込みに失敗しました');
    }
  };
  r.readAsText(f);
}

async function enableNotification(){
  if(!('Notification' in window)){ alert('この端末は通知非対応です'); return; }
  const p = await Notification.requestPermission();
  if(p !== 'granted'){ alert('通知が許可されませんでした'); return; }
  new Notification('BELLE HOUSE',{body:'点呼忘れ通知を有効にしました'});
}

function clearRecords(){
  if(confirm('点呼履歴をすべて削除しますか？')){
    localStorage.removeItem(LS_RECORDS);
    updateDashboard();
    renderRecords();
  }
}

document.addEventListener('DOMContentLoaded',init);
})();
