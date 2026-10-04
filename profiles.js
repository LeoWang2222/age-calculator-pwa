import {calculate, iso, lunarToSolar, solarToLunar, todayLocal} from './age-logic.js';

export const PROFILE_KEY = 'age-notebook.profiles.v1';
const MAX_PROFILES = 20;

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validId(id) {
  return typeof id === 'string' && id.length > 0 && id.trim() === id;
}

function profileName(name) {
  if (typeof name !== 'string') throw new Error('档案名称格式无效');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('请填写档案名称');
  if ([...trimmed].length > 20) throw new Error('档案名称最多 20 个字符');
  return trimmed;
}

function profileSettings(settings) {
  if (!record(settings) || settings.version !== 1 ||
      !['solar', 'lunar'].includes(settings.mode) ||
      ![settings.year, settings.month, settings.day, settings.targetAge].every(Number.isInteger) ||
      typeof settings.leap !== 'boolean') {
    throw new Error('生日档案格式无效');
  }
  if (settings.targetAge < 1 || settings.targetAge > 150) {
    throw new Error('时光目标须在 1–150 岁之间');
  }
  if (settings.mode === 'solar' && settings.leap) {
    throw new Error('公历生日不能设置农历闰月');
  }
  const value = {
    version: 1,
    mode: settings.mode,
    year: settings.year,
    month: settings.month,
    day: settings.day,
    leap: settings.leap,
    targetAge: settings.targetAge,
  };
  const birth = value.mode === 'lunar'
    ? lunarToSolar(value.year, value.month, value.day, value.leap)
    : iso(value.year, value.month, value.day);
  // Reading checks the birthday itself, without requiring a calculation for today.
  solarToLunar(birth);
  return {value, birth};
}

function cloneProfile(profile) {
  return {id: profile.id, name: profile.name, settings: {...profile.settings}};
}

export function readProfiles(storage) {
  let raw;
  try {
    raw = storage.getItem(PROFILE_KEY);
  } catch (error) {
    throw new Error('无法读取生日档案，请检查浏览器存储权限。', {cause: error});
  }
  if (raw === null || raw === undefined) return [];
  let list;
  try {
    if (typeof raw !== 'string') throw new Error('存储内容不是文本');
    list = JSON.parse(raw);
  } catch (error) {
    throw new Error('已保存的生日档案数据损坏，无法读取。', {cause: error});
  }
  if (!Array.isArray(list) || list.length > MAX_PROFILES) {
    throw new Error('已保存的生日档案格式无效（最多 20 个档案）');
  }
  const ids = new Set();
  return list.map(profile => {
    if (!record(profile) || !validId(profile.id) || ids.has(profile.id)) {
      throw new Error('已保存的生日档案标识无效或重复');
    }
    ids.add(profile.id);
    return {
      id: profile.id,
      name: profileName(profile.name),
      settings: profileSettings(profile.settings).value,
    };
  });
}

function writeProfiles(storage, list) {
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(list));
  } catch (error) {
    throw new Error('无法保存生日档案，请检查浏览器存储权限或可用空间。', {cause: error});
  }
}

function createId(list) {
  const ids = new Set(list.map(profile => profile.id));
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    if (!ids.has(id)) return id;
  }
  throw new Error('无法生成唯一档案标识，请重试');
}

export function saveProfile(storage, input) {
  // Read first so an unreadable or corrupt collection can never be replaced.
  const list = readProfiles(storage);
  if (!record(input)) throw new Error('生日档案格式无效');
  const name = profileName(input.name);
  const {value: settings, birth} = profileSettings(input.settings);
  calculate(birth, todayLocal(), settings.targetAge);
  let index = -1;
  let id = input.id;
  if (id !== undefined) {
    if (!validId(id)) throw new Error('生日档案标识无效');
    index = list.findIndex(profile => profile.id === id);
    if (index === -1) throw new Error('未找到该生日档案');
  } else {
    if (list.length >= MAX_PROFILES) throw new Error('最多保存 20 个生日档案');
    id = createId(list);
  }
  const saved = {id, name, settings};
  if (index === -1) list.push(saved);
  else list[index] = saved;
  writeProfiles(storage, list);
  return cloneProfile(saved);
}

export function removeProfile(storage, id) {
  const list = readProfiles(storage);
  if (!validId(id)) throw new Error('生日档案标识无效');
  const index = list.findIndex(profile => profile.id === id);
  if (index === -1) throw new Error('未找到该生日档案');
  list.splice(index, 1);
  writeProfiles(storage, list);
  return list.map(cloneProfile);
}
