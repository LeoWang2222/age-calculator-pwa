import {calculate,iso,parts,todayLocal,lunarMonths,lunarToSolar} from './age-logic.js';

const $=id=>document.getElementById(id);
const state={mode:'solar',lastBirth:null,lastResult:null};
const solarYear=$('solar-year'),solarMonth=$('solar-month'),solarDay=$('solar-day');
const lunarYear=$('lunar-year'),lunarMonth=$('lunar-month'),lunarDay=$('lunar-day');
const target=$('target-age');
const DEFAULT_KEY='age-notebook.default.v1';
function selectedDefault(){const lunar=state.mode==='lunar';const [month,leap]=lunarMonth.value.split('-').map(Number);return {version:1,mode:state.mode,year:Number(lunar?lunarYear.value:solarYear.value),month:lunar?month:Number(solarMonth.value),day:Number(lunar?lunarDay.value:solarDay.value),leap:lunar&&Boolean(leap),targetAge:Number(target.value)};}
function defaultBirth(value){if(!value||value.version!==1||!['solar','lunar'].includes(value.mode)||![value.year,value.month,value.day,value.targetAge].every(Number.isInteger)||typeof value.leap!=='boolean')throw new Error('默认生日格式无效');return value.mode==='lunar'?lunarToSolar(value.year,value.month,value.day,value.leap):iso(value.year,value.month,value.day);}
function defaultStatus(message,exists){$('default-status').textContent=message;if(exists!==undefined)$('remove-default').hidden=!exists;}
function restoreDefault(){let raw;try{raw=localStorage.getItem(DEFAULT_KEY);}catch{defaultStatus('此浏览器无法读取默认生日，仍可手动计算。');return;}if(!raw)return;try{const value=JSON.parse(raw);const birth=defaultBirth(value);calculate(birth,todayLocal(),value.targetAge);
  target.value=String(value.targetAge);setMode(value.mode);
  if(value.mode==='solar'){solarYear.value=String(value.year);solarMonth.value=String(value.month);updateSolarDays();solarDay.value=String(value.day);}else{lunarYear.value=String(value.year);updateLunarMonths();lunarMonth.value=`${value.month}-${Number(value.leap)}`;updateLunarDays();lunarDay.value=String(value.day);}
  defaultStatus('已载入默认生日；修改后可重新设为默认。',true);run(birth,false);
}catch{defaultStatus('默认生日未能载入，请重新设置。',true);}}
function saveDefault(){try{const value=selectedDefault();const birth=defaultBirth(value);calculate(birth,todayLocal(),value.targetAge);try{localStorage.setItem(DEFAULT_KEY,JSON.stringify(value));}catch{defaultStatus('此浏览器无法保存，请检查是否允许网站存储。');return;}defaultStatus('默认生日已保存，下次打开会自动计算。',true);run(birth,false);}catch(error){showError(error.message);}}
function removeDefault(){try{localStorage.removeItem(DEFAULT_KEY);defaultStatus('已取消默认生日，可随时重新设置。',false);}catch{defaultStatus('未能取消默认，请检查是否允许网站存储。');}}
function fill(el,items,value){el.replaceChildren(...items.map(([v,label])=>{const o=document.createElement('option');o.value=String(v);o.textContent=label;return o;}));if(value!==undefined&&items.some(([v])=>String(v)===String(value)))el.value=String(value);}
function range(a,b){return Array.from({length:b-a+1},(_,i)=>a+i);}
function localDate(s){const p=parts(s);return `${p.year}年${String(p.month).padStart(2,'0')}月${String(p.day).padStart(2,'0')}日`;}
function briefDate(s){const p=parts(s);return `${p.year}.${String(p.month).padStart(2,'0')}.${String(p.day).padStart(2,'0')}`;}
function updateSolarDays(){const y=Number(solarYear.value),m=Number(solarMonth.value),old=solarDay.value;const max=new Date(Date.UTC(y,m,0)).getUTCDate();const min=y===1900&&m===1?31:1;fill(solarDay,range(min,max).map(d=>[d,`${d}日`]),Math.min(Math.max(Number(old)||min,min),max));}
function updateLunarDays(){const selected=lunarMonths(Number(lunarYear.value)).find(m=>`${m.month}-${Number(m.leap)}`===lunarMonth.value);if(!selected)return;const old=Number(lunarDay.value)||1;fill(lunarDay,range(1,selected.days).map(d=>[d,`${d}日`]),Math.min(old,selected.days));}
function updateLunarMonths(){const old=lunarMonth.value,month=Number(old.split('-')[0])||1;const list=lunarMonths(Number(lunarYear.value));fill(lunarMonth,list.map(m=>[`${m.month}-${Number(m.leap)}`,m.label]),old);if(!list.some(m=>`${m.month}-${Number(m.leap)}`===old))lunarMonth.value=`${month}-0`;updateLunarDays();}
function setMode(mode){state.mode=mode;for(const m of ['solar','lunar']){const active=m===mode;$(m+'-tab').classList.toggle('active',active);$(m+'-tab').setAttribute('aria-selected',String(active));$(m+'-fields').hidden=!active;}hideError();}
function hideError(){$('form-error').hidden=true;}
function showError(message){state.lastResult=null;state.lastBirth=null;$('results').hidden=true;$('form-error').textContent=message;$('form-error').hidden=false;}
function resultText(r){const l=r.lunar;return [
  `周岁：${r.age}岁`,`虚岁：${r.virtualAge}岁`,`精确年龄：${r.precise.years}岁 ${r.precise.months}个月 ${r.precise.days}天`,`生肖：${r.animal}`,
  `星座：${r.zodiac}`,`公历出生日期：${localDate(r.birth)}`,`农历出生日期：${l.year}年${l.monthName}${l.dayName}（${r.ganzhi}）`,
  `下次公历生日：${localDate(r.nextSolar.date)}，还有${r.nextSolar.days}天，${r.nextSolar.weekday}`,
  `下次农历生日：${r.nextLunar.label} / 公历${localDate(r.nextLunar.date)}，还有${r.nextLunar.days}天，${r.nextLunar.weekday}`,
  `生活天数：${r.lifeDays}天`,`时光进度：${r.progress.toFixed(1)}%（目标${r.targetAge}岁）`,r.nextSolar.note,r.nextLunar.note].filter(Boolean).join('\n');}
function render(r){$('results').hidden=false;$('as-of').textContent=briefDate(r.today);$('age-years').textContent=r.age;$('precise-age').textContent=`准确地说，你已经 ${r.precise.years} 岁 ${r.precise.months} 个月 ${r.precise.days} 天`;
  $('virtual-age').textContent=`${r.virtualAge} 岁`;$('life-days').textContent=`${r.lifeDays.toLocaleString('zh-CN')} 天`;$('identity').textContent=`${r.animal} · ${r.zodiac}`;
  for(const [kind,next] of [['solar',r.nextSolar],['lunar',r.nextLunar]]){$(kind+'-count').textContent=next.days;$(kind+'-next').textContent=`${briefDate(next.date)} · ${next.weekday}`;$(kind+'-note').textContent=next.note;$(kind+'-note').hidden=!next.note;}
  $('solar-birth').textContent=localDate(r.birth);$('lunar-birth').textContent=`${r.lunar.year}年${r.lunar.monthName}${r.lunar.dayName}`;$('ganzhi-birth').textContent=r.ganzhi;$('zodiac-birth').textContent=`${r.animal}年生 · ${r.zodiac}`;
  $('progress-caption').textContent=`${r.age} / ${r.targetAge} 岁`;$('progress-number').textContent=`${r.progress.toFixed(1)}%`;$('progress-fill').style.width=`${r.progress}%`;$('copy-button').textContent='复制结果';
}
function run(birth,scroll=true){try{const r=calculate(birth,todayLocal(),Number(target.value));state.lastBirth=birth;state.lastResult=r;hideError();render(r);if(scroll)$('results').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){showError(e.message);}}
function init(){const today=todayLocal();$('header-date').textContent=briefDate(today);const maxYear=Math.min(parts(today).year,2100);
  fill(solarYear,range(1900,maxYear).reverse().map(y=>[y,`${y} 年`]),2000);fill(solarMonth,range(1,12).map(m=>[m,`${m} 月`]),1);updateSolarDays();
  fill(lunarYear,range(1900,maxYear).reverse().map(y=>[y,`${y} 年`]),2000);updateLunarMonths();fill(target,range(1,150).map(n=>[n,`${n} 岁`]),80);
  solarYear.addEventListener('change',updateSolarDays);solarMonth.addEventListener('change',updateSolarDays);lunarYear.addEventListener('change',updateLunarMonths);lunarMonth.addEventListener('change',updateLunarDays);
  $('solar-tab').addEventListener('click',()=>setMode('solar'));$('lunar-tab').addEventListener('click',()=>setMode('lunar'));
  $('age-form').addEventListener('submit',e=>{e.preventDefault();try{run(defaultBirth(selectedDefault()));}catch(error){showError(error.message);}});
  $('save-default').addEventListener('click',saveDefault);$('remove-default').addEventListener('click',removeDefault);
  target.addEventListener('change',()=>{if(state.lastBirth)run(state.lastBirth,false);});
  $('clear-button').addEventListener('click',()=>{state.lastBirth=null;state.lastResult=null;$('results').hidden=true;hideError();window.scrollTo({top:0,behavior:'smooth'});});
  $('copy-button').addEventListener('click',async()=>{if(!state.lastResult)return;try{await navigator.clipboard.writeText(resultText(state.lastResult));$('copy-button').textContent='已复制 ✓';}catch{const text=resultText(state.lastResult);const el=document.createElement('textarea');el.value=text;document.body.append(el);el.select();const ok=document.execCommand('copy');el.remove();$('copy-button').textContent=ok?'已复制 ✓':'复制失败';}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const now=todayLocal();$('header-date').textContent=briefDate(now);if(state.lastBirth&&state.lastResult?.today!==now)run(state.lastBirth,false);}});
  restoreDefault();
  if('serviceWorker' in navigator&&location.protocol!=='file:'){let reloadForUpdate=Boolean(navigator.serviceWorker.controller);navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadForUpdate){reloadForUpdate=false;location.reload();}});navigator.serviceWorker.register('./service-worker.js').catch(()=>{});}
}
init();
