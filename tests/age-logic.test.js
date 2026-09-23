import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,solarToLunar,lunarToSolar,lunarMonths} from '../age-logic.js';

test('verified calendar dates and round trips',()=>{
  for(const s of ['1900-01-31','1901-01-01','1996-07-16','2000-02-29','2026-09-23','2100-12-30']){
    const l=solarToLunar(s);assert.equal(lunarToSolar(l.year,l.month,l.day,l.leap),s);
  }
  assert.deepEqual([solarToLunar('1996-07-16').month,solarToLunar('1996-07-16').day],[6,1]);
});
test('leap day age uses original birthday anchors',()=>{
  const before=calculate('2000-02-29','2024-02-28');
  assert.deepEqual(before.precise,{years:23,months:11,days:30});
  assert.deepEqual(calculate('2000-02-29','2024-02-29').precise,{years:24,months:0,days:0});
  assert.equal(calculate('2000-02-29','2023-02-27').nextSolar.date,'2023-02-28');
});
test('birthday today selects next year',()=>{
  const r=calculate('2000-09-23','2026-09-23');
  assert.equal(r.age,26);assert.equal(r.nextSolar.date,'2027-09-23');
  assert.ok(r.nextSolar.days>0);assert.ok(r.nextLunar.days>0);
});
test('lunar leap month and invalid dates',()=>{
  const leap=lunarMonths(2025).find(m=>m.leap);
  assert.ok(leap);assert.equal(solarToLunar(lunarToSolar(2025,leap.month,1,true)).leap,true);
  assert.throws(()=>lunarToSolar(2026,leap.month,1,true),/闰月/);
  assert.throws(()=>lunarToSolar(2025,leap.month,31,true),/只有/);
});
test('future birth is rejected and target progress is capped',()=>{
  assert.throws(()=>calculate('2027-01-01','2026-09-23'),/未来/);
  assert.equal(calculate('1900-01-31','2026-09-23',80).progress,100);
});
