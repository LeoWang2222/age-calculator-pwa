import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE_KEY, readProfiles, saveProfile, removeProfile} from '../profiles.js';
import {lunarMonths} from '../age-logic.js';

const settings = overrides => ({
  version: 1, mode: 'solar', year: 2000, month: 2, day: 29,
  leap: false, targetAge: 80, ...overrides,
});
const profile = (id = 'stored-id', overrides = {}) => ({
  id, name: '测试档案', settings: settings(), ...overrides,
});

function memoryStorage(initial = null) {
  let raw = initial;
  const writes = [];
  return {
    getItem(key) { assert.equal(key, PROFILE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, PROFILE_KEY); writes.push(value); raw = value; },
    get raw() { return raw; },
    writes,
  };
}

function onDate(isoDate, action) {
  const RealDate = globalThis.Date;
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [`${isoDate}T12:00:00`])); }
    static now() { return new RealDate(`${isoDate}T12:00:00`).getTime(); }
  };
  try { return action(); }
  finally { globalThis.Date = RealDate; }
}

test('missing storage is an empty collection; saving trims names and preserves both calendars', () => {
  onDate('2026-10-04', () => {
    const storage = memoryStorage();
    assert.deepEqual(readProfiles(storage), []);
    const first = saveProfile(storage, {name: '  公历档案  ', settings: settings()});
    assert.ok(first.id);
    assert.equal(first.name, '公历档案');
    const leap = lunarMonths(2025).find(month => month.leap);
    const second = saveProfile(storage, {
      name: '农历档案',
      settings: settings({mode: 'lunar', year: 2025, month: leap.month, day: 1, leap: true}),
    });
    assert.notEqual(second.id, first.id);
    assert.deepEqual(readProfiles(storage), [first, second]);
    assert.equal(second.settings.leap, true);
  });
});

test('updating keeps id and order; removing deletes only the requested profile', () => {
  onDate('2026-10-04', () => {
    const storage = memoryStorage(JSON.stringify([profile('one'), profile('two')]));
    const updated = saveProfile(storage, {
      id: 'one', name: '已更新', settings: settings({targetAge: 90}),
    });
    assert.equal(updated.id, 'one');
    assert.deepEqual(readProfiles(storage).map(item => item.id), ['one', 'two']);
    assert.equal(readProfiles(storage)[0].settings.targetAge, 90);
    assert.deepEqual(removeProfile(storage, 'one').map(item => item.id), ['two']);
    removeProfile(storage, 'two');
    assert.equal(storage.raw, '[]');
  });
});

test('unknown ids never create or remove a profile', () => {
  onDate('2026-10-04', () => {
    const storage = memoryStorage(JSON.stringify([profile()]));
    const before = storage.raw;
    assert.throws(() => saveProfile(storage, {
      id: 'missing', name: '测试档案', settings: settings(),
    }), /未找到/);
    assert.throws(() => removeProfile(storage, 'missing'), /未找到/);
    assert.equal(storage.raw, before);
    assert.equal(storage.writes.length, 0);
  });
});

test('names, settings types, solar dates, lunar dates and target ages are validated before writing', () => {
  onDate('2026-10-04', () => {
    const invalid = [
      {name: '   ', settings: settings()},
      {name: '名'.repeat(21), settings: settings()},
      {name: 123, settings: settings()},
      {name: '无效', settings: settings({version: 2})},
      {name: '无效', settings: settings({mode: 'other'})},
      {name: '无效', settings: settings({year: '2000'})},
      {name: '无效', settings: settings({leap: 0})},
      {name: '无效', settings: settings({year: 2001})},
      {name: '无效', settings: settings({year: 1900, month: 1, day: 30})},
      {name: '无效', settings: settings({leap: true})},
      {name: '无效', settings: settings({mode: 'lunar', year: 2026, month: 6, day: 1, leap: true})},
      {name: '无效', settings: settings({mode: 'lunar', year: 2025, month: 6, day: 31})},
      ...[0, 151, 80.5, '80'].map(targetAge => ({name: '无效', settings: settings({targetAge})})),
    ];
    for (const input of invalid) {
      const storage = memoryStorage();
      assert.throws(() => saveProfile(storage, input), Error);
      assert.equal(storage.writes.length, 0);
    }
    const storage = memoryStorage();
    assert.equal(saveProfile(storage, {name: '😀'.repeat(20), settings: settings()}).name.length, 40);
  });
});

test('future birthdays and the calculation boundary remain readable but fail new saves', () => {
  const future = profile('future', {settings: settings({year: 2100, month: 12, day: 30})});
  const storage = memoryStorage(JSON.stringify([future]));
  onDate('2026-10-04', () => {
    assert.deepEqual(readProfiles(storage), [future]);
    assert.throws(() => saveProfile(storage, future), /未来/);
  });
  onDate('2101-01-01', () => {
    assert.deepEqual(readProfiles(storage), [future]);
    assert.throws(() => saveProfile(storage, future), /支持范围/);
  });
  onDate('2100-12-30', () => {
    assert.deepEqual(readProfiles(storage), [future]);
    assert.throws(() => saveProfile(storage, future), /下次农历生日/);
  });
  assert.equal(storage.writes.length, 0);
});

test('malformed JSON, invalid schemas and duplicate ids cannot be silently overwritten', () => {
  onDate('2026-10-04', () => {
    const invalid = [
      '', '{broken', 'null', '{}', '[null]',
      JSON.stringify([profile('', {})]),
      JSON.stringify([profile(' space ')]),
      JSON.stringify([profile('same'), profile('same')]),
      JSON.stringify([profile('bad', {name: ''})]),
      JSON.stringify([profile('bad', {settings: settings({month: 13})})]),
      JSON.stringify([profile('bad', {settings: settings({targetAge: 0})})]),
    ];
    for (const raw of invalid) {
      const storage = memoryStorage(raw);
      assert.throws(() => readProfiles(storage), Error);
      assert.throws(() => saveProfile(storage, {name: '测试档案', settings: settings()}), Error);
      assert.throws(() => removeProfile(storage, 'stored-id'), Error);
      assert.equal(storage.raw, raw);
      assert.equal(storage.writes.length, 0);
    }
  });
});

test('20 profiles allow an update, reject another creation, and free capacity after removal', () => {
  onDate('2026-10-04', () => {
    const list = Array.from({length: 20}, (_, index) => profile(`profile-${index}`));
    const storage = memoryStorage(JSON.stringify(list));
    assert.throws(() => saveProfile(storage, {name: '新增', settings: settings()}), /最多/);
    assert.equal(storage.writes.length, 0);
    saveProfile(storage, {id: 'profile-0', name: '更新', settings: settings()});
    assert.equal(readProfiles(storage).length, 20);
    removeProfile(storage, 'profile-1');
    saveProfile(storage, {name: '新增', settings: settings()});
    assert.equal(readProfiles(storage).length, 20);
    const tooMany = memoryStorage(JSON.stringify([...list, profile('extra')]));
    assert.throws(() => readProfiles(tooMany), /最多/);
    assert.throws(() => saveProfile(tooMany, {name: '新增', settings: settings()}), Error);
    assert.equal(tooMany.writes.length, 0);
  });
});

test('input objects and returned profiles cannot modify stored values', () => {
  onDate('2026-10-04', () => {
    const storage = memoryStorage();
    const input = {name: '测试档案', settings: settings()};
    const saved = saveProfile(storage, input);
    input.settings.targetAge = 1;
    saved.name = '被修改';
    saved.settings.day = 1;
    const read = readProfiles(storage);
    read[0].settings.targetAge = 2;
    read.push(profile('not-saved'));
    assert.equal(readProfiles(storage)[0].name, '测试档案');
    assert.equal(readProfiles(storage)[0].settings.day, 29);
    assert.equal(readProfiles(storage)[0].settings.targetAge, 80);
    assert.equal(readProfiles(storage).length, 1);
  });
});

test('storage access and quota failures are reported without successful mutations', () => {
  onDate('2026-10-04', () => {
    const unavailable = {getItem() { throw new Error('blocked'); }};
    assert.throws(() => readProfiles(unavailable), /无法读取/);
    assert.throws(() => saveProfile(unavailable, {name: '测试档案', settings: settings()}), /无法读取/);
    const raw = JSON.stringify([profile()]);
    const full = {
      getItem() { return raw; },
      setItem() { throw new Error('quota'); },
    };
    assert.throws(() => saveProfile(full, {name: '新增', settings: settings()}), /无法保存/);
    assert.throws(() => removeProfile(full, 'stored-id'), /无法保存/);
    assert.deepEqual(readProfiles(full), [profile()]);
  });
});
