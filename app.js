
(function(){
'use strict';

const ADMIN_ID = 'admin';
const ADMIN_PASS = '1234';
const LS_RECORDS = 'belle_house_tenko_v40_records';
const LS_DRIVERS = 'belle_house_tenko_v40_drivers';
const LS_ADMINS = 'belle_house_tenko_v40_admins';

let currentUser = '';
let gpsData = null;
let recordsCache = [];
let driversCache = [];
let adminsCache = [];

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
const localGet = key => JSON.parse(localStorage.getItem(key) || '[]');
const localSet = (key,val) => localStorage.setItem(key, JSON.stringify(val));
const getRecords = () => recordsCache.length ? recordsCache : localGet(LS_RECORDS);
const getDrivers = () => driversCache.length ? driversCache : localGet(LS_DRIVERS);
const getAdmins = () => adminsCache.length ? adminsCache : localGet(LS_ADMINS);
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function init(){
  renderCheckList();
  bindEvents();
  setupCloud();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

function setupCloud(){
  window.addEventListener('belle-cloud-status', e => {
    const sync = $('syncStatus');
    if(sync) sync.textContent = e.detail === 'cloud' ? 'クラウド同期ON' : 'ローカル保存';
  });

  setTimeout(() => {
    const cloud = window.BELLE_CLOUD;
    const sync = $('syncStatus');

    if(cloud && cloud.enabled){
      if(sync) sync.textContent = 'クラウド同期ON';

      cloud.onRecords(records => {
        recordsCache = records.sort((a,b) => String(b.id).localeCompare(String(a.id)));
        localSet(LS_RECORDS, recordsCache);
        refreshAdmin();
      });

      cloud.onDrivers(drivers => {
        driversCache = drivers;
        localSet(LS_DRIVERS, driversCache);
        refreshAdmin();
      });

      cloud.onAdmins(admins => {
        adminsCache = admins;
        localSet(LS_ADMINS, adminsCache);
        renderAdmins();
      });
    } else {
      if(sync) sync.textContent = 'ローカル保存';
    }
  }, 1200);
}

function bindEvents(){
  bind('loginBtn','click',login);
  bind('gpsBtn','click',getGPS);
  bind('submitRollcallBtn','click',submitRollcall);
  bind('driverLogoutBtn','click',()=>location.reload());
  bind('adminLogoutBtn','click',()=>location.reload());
  bind('exportCsvBtn','click',exportCSV);
  bind('printPdfBtn','click',()=>window.print());
  bind('backupBtn','click',backupData);
  bind('restoreBtn','click',()=>$('restoreInput')?.click());
  bind('restoreInput','change',restoreData);
  bind('clearRecordsBtn','click',clearRecords);
  bind('notifyBtn','click',enableNotification);
  bind('addDriverBtn','click',addDriver);
  bind('addAdminBtn','click',addAdmin);
  bind('recordFilter','change',renderRecords);
  bind('driverSearch','input',renderRecords);
  bind('dateSearch','change',renderRecords);
  bind('photoInput','change',previewPhoto);

  document.querySelectorAll('.admin-nav button[data-tab]').forEach(btn=>{
    btn.addEventListener('click',()=>showAdminTab(btn.dataset.tab));
  });

  $('driversBody')?.addEventListener('click', e => {
    if(e.target.dataset.deleteDriver !== undefined) deleteDriver(Number(e.target.dataset.deleteDriver));
  });

  $('adminsBody')?.addEventListener('click', e => {
    if(e.target.dataset.deleteAdmin !== undefined) deleteAdmin(Number(e.target.dataset.deleteAdmin));
  });
}

function bind(id,event,fn){
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
}

function getGPS(){
  if(!navigator.geolocation){
    alert('GPS非対応です');
    return;
  }

  $('gpsText').value = '取得中...';

  navigator.geolocation.getCurrentPosition(p => {
    gpsData = {
      lat: p.coords.latitude,
      lng: p.coords.longitude,
      accuracy: p.coords.accuracy,
      time: nowText()
    };
    $('gpsText').value = `緯度:${gpsData.lat.toFixed(6)} 経度:${gpsData.lng.toFixed(6)} 精度:${Math.round(gpsData.accuracy)}m`;
  }, () => {
    gpsData = null;
    $('gpsText').value = '取得失敗';
    alert('GPS取得に失敗しました。位置情報を許可してください。');
  }, {enableHighAccuracy:true, timeout:10000, maximumAge:0});
}

function previewPhoto(){
  const file = $('photoInput')?.files?.[0];
  if(!file){
    $('photoPreview')?.classList.add('hidden');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    $('photoPreview').src = reader.result;
    $('photoPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function submitRollcall(){
  const checks = {};
  CHECK_ITEMS.forEach(([id]) => checks[id] = !!$(id)?.checked);

  const allOk = CHECK_ITEMS.every(([id]) => checks[id]);
  if(!allOk && !confirm('未チェック項目があります。要確認として送信しますか？')) return;

  const saveRecord = async photo => {
    const record = {
      id: String(Date.now()),
      ok: allOk,
      time: nowText(),
      date: todayKey(),
      isoDate: isoDate(),
      month: monthKey(),
      driver: currentUser,
      name: currentUser,
      type: $('rollcallType')?.value || '',
      method: $('rollcallMethod')?.value || '',
      vehicleNo: $('vehicleNo')?.value.trim() || '',
      odometer: $('odometer')?.value.trim() || '',
      alcoholValue: $('alcoholValue')?.value.trim() || '',
      alcohol: $('alcoholValue')?.value.trim() || '',
      sleepHours: $('sleepHours')?.value.trim() || '',
      health: checks.healthGood ? '良好' : '要確認',
      instruction: $('instruction')?.value.trim() || '',
      deliveryNote: $('deliveryNote')?.value.trim() || '',
      checks,
      gps: gpsData,
      photo: photo || '',
      remarks: $('remarks')?.value.trim() || '',
      createdAt: nowText()
    };

    const records = getRecords();
    records.unshift(record);
    localSet(LS_RECORDS, records);

    if(window.BELLE_CLOUD && window.BELLE_CLOUD.enabled){
      await window.BELLE_CLOUD.saveRecord(record);
    }

    alert('点呼を送信しました');
    resetDriverForm();
  };

  const file = $('photoInput')?.files?.[0];
  if(file){
    const reader = new FileReader();
    reader.onload = () => saveRecord(reader.result);
    reader.readAsDataURL(file);
  }else{
    await saveRecord('');
  }
}

function resetDriverForm(){
  ['odometer','alcoholValue','sleepHours','instruction','deliveryNote','remarks','gpsText','photoInput'].forEach(id => {
    if($(id)) $(id).value = '';
  });
  CHECK_ITEMS.forEach(([id]) => {
    if($(id)) $(id).checked = false;
  });
  $('photoPreview')?.classList.add('hidden');
  gpsData = null;
}

function showAdminTab(tab){
  document.querySelectorAll('.admin-tab').forEach(el => el.classList.add('hidden'));
  const target = $(`${tab}Tab`);
  if(target) target.classList.remove('hidden');

  if(tab === 'dashboard') updateDashboard();
  if(tab === 'records') renderRecords();
  if(tab === 'drivers') renderDrivers();
  if(tab === 'admins') renderAdmins();
}

function refreshAdmin(){
  if($('adminView') && !$('adminView').classList.contains('hidden')){
    updateDashboard();
    renderRecords();
    renderDrivers();
    renderAdmins();
  }
}

function updateDashboard(){
  const records = getRecords();
  const drivers = getDrivers();

  if($('statToday')) $('statToday').textContent = records.filter(r => r.date === todayKey()).length;
  if($('statNeedCheck')) $('statNeedCheck').textContent = records.filter(r => !r.ok).length;
  if($('statDrivers')) $('statDrivers').textContent = drivers.length;
  if($('statMonth')) $('statMonth').textContent = records.filter(r => r.month === monthKey()).length;

  const todayNames = new Set(records.filter(r => r.date === todayKey()).map(r => r.driver || r.name));
  const missing = drivers.filter(d => !todayNames.has(d.name)).map(d => d.name);

  if($('missingToday')) $('missingToday').textContent = missing.length ? missing.join('、') : '未点呼者はいません';

  drawChart();
}

function drawChart(){
  const canvas = $('summaryChart');
  if(!canvas) return;

  const ctx = canvas.getContext('2d');
  const records = getRecords();

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const labels = ['今日','今月','要確認','登録'];
  const values = [
    records.filter(r => r.date === todayKey()).length,
    records.filter(r => r.month === monthKey()).length,
    records.filter(r => !r.ok).length,
    getDrivers().length
  ];

  const max = Math.max(...values,1);

  ctx.fillStyle = '#071f3d';
  ctx.font = '16px sans-serif';

  labels.forEach((label,i) => {
    const h = (values[i] / max) * 160;
    const x = 60 + i * 120;
    ctx.fillRect(x, 210 - h, 70, h);
    ctx.fillText(label, x, 235);
    ctx.fillText(values[i], x + 24, 200 - h);
  });
}

function filteredRecords(){
  let records = getRecords();
  const filter = $('recordFilter')?.value || 'today';
  const search = $('driverSearch')?.value.trim() || '';
  const date = $('dateSearch')?.value || '';

  if(filter === 'today') records = records.filter(r => r.date === todayKey());
  if(filter === 'need') records = records.filter(r => !r.ok);
  if(filter === 'month') records = records.filter(r => r.month === monthKey());
  if(search) records = records.filter(r => (r.driver || r.name || '').includes(search));
  if(date) records = records.filter(r => r.isoDate === date);

  return records;
}

function renderRecords(){
  const body = $('recordsBody');
  if(!body) return;

  const records = filteredRecords();

  if(!records.length){
    body.innerHTML = '<tr><td colspan="9">履歴はありません</td></tr>';
    return;
  }

  body.innerHTML = records.map(r => {
    const checks = CHECK_ITEMS.map(([id,label]) => `${r.checks?.[id] ? '✅' : '❌'}${esc(label)}`).join('<br>');
    const gps = r.gps ? `<a class="maplink" target="_blank" href="https://www.google.com/maps?q=${r.gps.lat},${r.gps.lng}">地図</a>` : '';
    return `<tr>
      <td class="${r.ok ? 'status-ok' : 'status-ng'}">${r.ok ? 'OK' : '要確認'}</td>
      <td>${esc(r.time)}</td>
      <td>${esc(r.type)}</td>
      <td>${esc(r.driver || r.name)}</td>
      <td>${esc(r.vehicleNo)}<br>${esc(r.odometer)}</td>
      <td>${checks}<br>ALC:${esc(r.alcoholValue || r.alcohol)}<br>睡眠:${esc(r.sleepHours)}</td>
      <td>${gps}</td>
      <td>${r.photo ? `<img class="photo" src="${r.photo}">` : ''}</td>
      <td>${esc(r.remarks)}</td>
    </tr>`;
  }).join('');
}

async function addDriver(){
  const name = $('newDriverName').value.trim();
  if(!name){
    alert('ドライバー名を入力してください');
    return;
  }

  const driver = {
    id: String(Date.now()),
    name,
    tel: $('newDriverTel')?.value.trim() || '',
    license: $('newDriverLicense')?.value || '',
    vehicle: $('newDriverVehicle')?.value.trim() || '',
    memo: $('newDriverMemo')?.value.trim() || '',
    created: nowText(),
    createdAt: nowText()
  };

  const drivers = getDrivers();
  drivers.unshift(driver);
  localSet(LS_DRIVERS, drivers);

  if(window.BELLE_CLOUD && window.BELLE_CLOUD.enabled){
    await window.BELLE_CLOUD.saveDriver(driver);
  }

  renderDrivers();
  updateDashboard();
}

function renderDrivers(){
  const body = $('driversBody');
  if(!body) return;

  const drivers = getDrivers();

  if(!drivers.length){
    body.innerHTML = '<tr><td colspan="7">登録ドライバーはありません</td></tr>';
    return;
  }

  body.innerHTML = drivers.map((d,i) => `<tr>
    <td>${esc(d.name)}</td>
    <td>${esc(d.tel)}</td>
    <td>${esc(d.license)}</td>
    <td>${esc(d.vehicle)}</td>
    <td>${esc(d.memo)}</td>
    <td>${esc(d.created || d.createdAt)}</td>
    <td><button class="danger" data-delete-driver="${i}">削除</button></td>
  </tr>`).join('');
}

async function deleteDriver(i){
  if(!confirm('このドライバーを削除しますか？')) return;

  const drivers = getDrivers();
  const target = drivers[i];
  drivers.splice(i,1);
  localSet(LS_DRIVERS, drivers);

  if(window.BELLE_CLOUD && window.BELLE_CLOUD.enabled && target){
    await window.BELLE_CLOUD.deleteDriver(target.id);
  }

  renderDrivers();
  updateDashboard();
}

async function addAdmin(){
  const name = $('newAdminId')?.value.trim() || '';
  const pass = $('newAdminPass')?.value.trim() || '';

  if(!name || !pass){
    alert('管理者IDとパスワードを入力してください');
    return;
  }

  const admin = { id:name, name, pass, created: nowText() };
  const admins = getAdmins().filter(a => a.id !== name);
  admins.push(admin);
  localSet(LS_ADMINS, admins);

  if(window.BELLE_CLOUD && window.BELLE_CLOUD.enabled){
    await window.BELLE_CLOUD.saveAdmin(admin);
  }

  renderAdmins();
}

function renderAdmins(){
  const body = $('adminsBody');
  if(!body) return;

  const admins = [{id:'admin',name:'admin',created:'初期管理者'}, ...getAdmins()];
  body.innerHTML = admins.map((a,i) => `<tr>
    <td>${esc(a.name)}</td>
    <td>${esc(a.created)}</td>
    <td>${a.id === 'admin' ? '削除不可' : `<button class="danger" data-delete-admin="${i-1}">削除</button>`}</td>
  </tr>`).join('');
}

async function deleteAdmin(i){
  const admins = getAdmins();
  const target = admins[i];
  admins.splice(i,1);
  localSet(LS_ADMINS, admins);

  if(window.BELLE_CLOUD && window.BELLE_CLOUD.enabled && target){
    await window.BELLE_CLOUD.deleteAdmin(target.id);
  }

  renderAdmins();
}

function exportCSV(){
  const rows = [['判定','日時','点呼区分','名前','車両番号','アルコール','GPS','備考']];
  filteredRecords().forEach(r => rows.push([
    r.ok ? 'OK' : '要確認',
    r.time,
    r.type,
    r.driver || r.name,
    r.vehicleNo,
    r.alcoholValue || r.alcohol,
    r.gps ? `${r.gps.lat},${r.gps.lng}` : '',
    r.remarks
  ]));

  const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'belle-house-tenko-cloud.csv';
  a.click();
}

function backupData(){
  const data = { records:getRecords(), drivers:getDrivers(), admins:getAdmins(), created:nowText() };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'belle-house-tenko-backup.json';
  a.click();
}

function restoreData(e){
  const file = e.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(data.records) localSet(LS_RECORDS, data.records);
      if(data.drivers) localSet(LS_DRIVERS, data.drivers);
      if(data.admins) localSet(LS_ADMINS, data.admins);
      alert('バックアップを読み込みました');
      location.reload();
    }catch{
      alert('読み込みに失敗しました');
    }
  };
  reader.readAsText(file);
}

async function enableNotification(){
  if(!('Notification' in window)){
    alert('この端末は通知非対応です');
    return;
  }
  const permission = await Notification.requestPermission();
  if(permission !== 'granted'){
    alert('通知が許可されませんでした');
    return;
  }
  new Notification('BELLE HOUSE', { body:'点呼忘れ通知を有効にしました' });
}

function clearRecords(){
  if(confirm('点呼履歴をすべて削除しますか？')){
    localStorage.removeItem(LS_RECORDS);
    updateDashboard();
    renderRecords();
  }
}

document.addEventListener('DOMContentLoaded', init);
})();
