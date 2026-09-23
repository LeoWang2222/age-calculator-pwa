import calendar from './calendar-data.js';

const MS_DAY = 86400000;
const MIN = '1900-01-31';
const MAX = '2100-12-30';
const GAN = [...'甲乙丙丁戊己庚辛壬癸'];
const ZHI = [...'子丑寅卯辰巳午未申酉戌亥'];
const ANIMALS = [...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
const MONTH_NAMES = [...'正二三四五六七八九十冬腊'];
const DAY_NAMES = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const WEEKDAYS = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const months = calendar.months.map(([year, month, leap, start, days]) => ({year, month, leap: !!leap, start, days}));
const monthMap = new Map(months.map(m => [`${m.year}-${m.month}-${Number(m.leap)}`, m]));

export function iso(y,m,d){return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
export function parts(s){const [year,month,day]=s.split('-').map(Number);return {year,month,day};}
function time(s){const {year,month,day}=parts(s);return Date.UTC(year,month-1,day);}
export function addDays(s,n){return new Date(time(s)+n*MS_DAY).toISOString().slice(0,10);}
export function diffDays(a,b){return Math.round((time(b)-time(a))/MS_DAY);}
function daysInMonth(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate();}
function validSolar(s){const {year,month,day}=parts(s);return Number.isInteger(year)&&month>=1&&month<=12&&day>=1&&day<=daysInMonth(year,month)&&iso(year,month,day)===s;}
function assertSolar(s){if(!validSolar(s)||s<MIN||s>MAX)throw new Error('公历日期超出支持范围（1900-01-31 至 2100-12-30）');}
export function todayLocal(){const d=new Date();return iso(d.getFullYear(),d.getMonth()+1,d.getDate());}
export function monthLabel(month,leap=false){return `${leap?'闰':''}${MONTH_NAMES[month-1]}月`;}
export function lunarMonths(year){if(year<1900||year>2100)throw new Error('农历年份超出支持范围（1900–2100）');return months.filter(m=>m.year===year).map(m=>({month:m.month,leap:m.leap,label:monthLabel(m.month,m.leap),days:m.days}));}
export function solarToLunar(s){assertSolar(s);let lo=0,hi=months.length-1;while(lo<=hi){const mid=(lo+hi)>>1;if(months[mid].start<=s)lo=mid+1;else hi=mid-1;}const m=months[hi];if(!m)throw new Error('找不到对应的农历日期');const day=diffDays(m.start,s)+1;const gi=(m.year-4)%10,zi=(m.year-4)%12;return {year:m.year,month:m.month,day,leap:m.leap,monthName:monthLabel(m.month,m.leap),dayName:DAY_NAMES[day-1],ganzhi:GAN[gi]+ZHI[zi],animal:ANIMALS[zi]};}
export function lunarToSolar(year,month,day,leap=false){const m=monthMap.get(`${year}-${month}-${Number(leap)}`);if(!m)throw new Error(leap?'该年没有这个闰月':'无效的农历月份');if(!Number.isInteger(day)||day<1||day>m.days)throw new Error(`该农历月份只有 ${m.days} 天`);const s=addDays(m.start,day-1);assertSolar(s);return s;}
function birthdayInYear(birth,year){const b=parts(birth);return iso(year,b.month,Math.min(b.day,daysInMonth(year,b.month)));}
function addMonths(birth,n){const b=parts(birth),index=b.month-1+n,year=b.year+Math.floor(index/12),month=index%12+1;return iso(year,month,Math.min(b.day,daysInMonth(year,month)));}
function sunLongitude(jde){const t=(jde-2451545)/36525,l0=280.46646+36000.76983*t+0.0003032*t*t,m=357.52911+35999.05029*t-0.0001537*t*t,mRad=m%360*Math.PI/180;
  const c=(1.914602-0.004817*t-0.000014*t*t)*Math.sin(mRad)+(0.019993-0.000101*t)*Math.sin(2*mRad)+0.000289*Math.sin(3*mRad);return (l0+c)%360;}
function jieDay(year,month){const saved=calendar.jie_days[String(year)]?.[String(month)];if(saved)return saved;if(year!==1900)throw new Error('节气超出支持范围');
  const target=(285+(month-1)*30)%360;
  for(let day=1;day<=10;day++){const jd=jdn(iso(year,month,day))+0.5-8/24-1e-8;const before=(sunLongitude(jd-1)-target+540)%360-180,after=(sunLongitude(jd)-target+540)%360-180;if(before<0&&after>=0)return day;}
  throw new Error('无法确定节气日期');}
function ganzhiYear(s){const {year}=parts(s);const feb=iso(year,2,jieDay(year,2));const y=s<feb?year-1:year;return GAN[((y-4)%10+10)%10]+ZHI[((y-4)%12+12)%12];}
function ganzhiMonth(s){const {year,month}=parts(s);const jie=jieDay(year,month);
  const zhiIndex=(s>=iso(year,month,jie)?month:month-1)%12;
  const ganYear=s<iso(year,2,jieDay(year,2))?year-1:year;
  const base=[2,4,6,8,0][((ganYear-4)%10)%5];
  return GAN[(base+(zhiIndex-2+12)%12)%10]+ZHI[zhiIndex];
}
function jdn(s){let {year:y,month:m,day:d}=parts(s);const a=Math.floor((14-m)/12);y=y+4800-a;m=m+12*a-3;return d+Math.floor((153*m+2)/5)+365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)-32045;}
function ganzhiDay(s){const i=(jdn(s)+49)%60;return GAN[i%10]+ZHI[i%12];}
function zodiac(month,day){const signs=[[1,20,'水瓶座'],[2,19,'双鱼座'],[3,21,'白羊座'],[4,20,'金牛座'],[5,21,'双子座'],[6,22,'巨蟹座'],[7,23,'狮子座'],[8,23,'处女座'],[9,23,'天秤座'],[10,24,'天蝎座'],[11,23,'射手座'],[12,22,'摩羯座']];let found=signs.at(-1)[2];for(const [m,d,name] of signs){if(month>m||(month===m&&day>=d))found=name;else break;}return found;}
function weekday(s){return WEEKDAYS[new Date(time(s)).getUTCDay()];}
export function calculate(birth,today=todayLocal(),targetAge=80){assertSolar(birth);assertSolar(today);if(birth>today)throw new Error('出生日期不能在未来！');if(!Number.isInteger(targetAge)||targetAge<1||targetAge>150)throw new Error('时光目标须在 1–150 岁之间');
  const b=parts(birth),t=parts(today),lunar=solarToLunar(birth),todayLunar=solarToLunar(today);
  let age=t.year-b.year;if(birthdayInYear(birth,t.year)>today)age--;
  let monthsOld=0;while(monthsOld<11&&addMonths(birth,age*12+monthsOld+1)<=today)monthsOld++;
  const daysOld=diffDays(addMonths(birth,age*12+monthsOld),today);
  let nextSolar=birthdayInYear(birth,t.year);if(nextSolar<=today)nextSolar=birthdayInYear(birth,t.year+1);
  let nextLunar=null,lunarLabel='',lunarNote='';
  for(let y=todayLunar.year;y<=2100;y++){
    let leap=lunar.leap;const notes=[];
    if(leap&&!monthMap.has(`${y}-${lunar.month}-1`)){leap=false;notes.push('当年无对应闰月，按同名农历月份计算');}
    const m=monthMap.get(`${y}-${lunar.month}-${Number(leap)}`);if(!m)continue;
    const day=Math.min(lunar.day,m.days);if(day!==lunar.day)notes.push('当年该农历月不足原生日天数，按当月最后一天计算');
    const candidate=addDays(m.start,day-1);if(candidate>MAX)break;
    if(candidate>today){nextLunar=candidate;lunarLabel=`${y}年${monthLabel(lunar.month,leap)}${DAY_NAMES[day-1]}`;lunarNote=notes.join('；');break;}
  }
  if(!nextLunar)throw new Error('下次农历生日超出当前农历数据支持范围');
  return {birth,today,lunar,age,virtualAge:todayLunar.year-lunar.year+1,precise:{years:age,months:monthsOld,days:daysOld},lifeDays:diffDays(birth,today),animal:lunar.animal,zodiac:zodiac(b.month,b.day),ganzhi:`${ganzhiYear(birth)}年 ${ganzhiMonth(birth)}月 ${ganzhiDay(birth)}日`,nextSolar:{date:nextSolar,days:diffDays(today,nextSolar),weekday:weekday(nextSolar),note:b.month===2&&b.day===29?'2月29日生日在非闰年按2月28日计算。':''},nextLunar:{date:nextLunar,days:diffDays(today,nextLunar),weekday:weekday(nextLunar),label:lunarLabel,note:lunarNote},targetAge,progress:Math.min(100,Math.max(0,age/targetAge*100))};
}
