'use strict';

// Everything runs in this browser. Payroll HTML is parsed locally and never uploaded.
const KEY = 'work-schedule-pwa-v1';
const MONTHS = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const PAYROLL_PROFILES = {
  jan: {tariff:162.90,hazardPct:11.4,taskPct:50,servicePct:50,qualityPct:50,professionalPct:0,productivityPct:35,productionBonusPct:35,nightPct:114,eveningPct:57,taxableBenefit:2329,mealDeduction:3026},
  feb: {tariff:162.90,hazardPct:11.4,taskPct:50,servicePct:50,qualityPct:50,professionalPct:0,productivityPct:35,productionBonusPct:35,nightPct:114,eveningPct:57,taxableBenefit:2466,mealDeduction:3204},
  mar: {tariff:162.90,hazardPct:11.8,taskPct:50,servicePct:50,qualityPct:50,professionalPct:0,productivityPct:45,productionBonusPct:25,nightPct:118,eveningPct:59,taxableBenefit:2055,mealDeduction:2670},
  sep: {tariff:162.90,hazardPct:12.6,taskPct:50,servicePct:45,qualityPct:50,professionalPct:12.6,productivityPct:70,productionBonusPct:0,nightPct:126,eveningPct:63,taxableBenefit:2329,mealDeduction:3026}
};
const salaryDefaults = {
  profile:'sep', tariff:162.90, dayHours:11.5, nightShiftHours:10.5, hoursOverride:0,
  nightPremiumPerShift:8.95, eveningPremiumPerShift:1.5, nightPremiumHoursOverride:0, eveningPremiumHoursOverride:0,
  vacationPay:0, taxableBenefit:2329, taxRate:13, unionRate:1, mealDeduction:3026,
  otherDeductions:0, advancePaid:0, otherPaid:0, ...PAYROLL_PROFILES.sep
};
const defaults = {leave:[],shifts:{},salary:{...salaryDefaults},payrollHistory:[],latestImportedRates:null};
// Initial shift entries transcribed from the supplied October schedule. Leave takes precedence.
[1,4,5,8,9,11,12,13,16,17,21,22,25,26,27,30,31].forEach(d=>defaults.shifts[`2026-10-${String(d).padStart(2,'0')}`]='DAY');
defaults.shifts['2026-10-18']='NIGHT';
for(let d=1;d<=14;d++) defaults.leave.push(`2026-10-${String(d).padStart(2,'0')}`);

const $ = id => document.getElementById(id);
const MONEY = new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:2,maximumFractionDigits:2});
const NUMBER = new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:2});
const SALARY_FIELDS = {
  payTariff:'tariff',dayHours:'dayHours',nightShiftHours:'nightShiftHours',hoursOverride:'hoursOverride',
  nightPremiumPerShift:'nightPremiumPerShift',eveningPremiumPerShift:'eveningPremiumPerShift',
  nightPremiumHoursOverride:'nightPremiumHoursOverride',eveningPremiumHoursOverride:'eveningPremiumHoursOverride',
  vacationPay:'vacationPay',taxableBenefit:'taxableBenefit',taxRate:'taxRate',unionRate:'unionRate',
  mealDeduction:'mealDeduction',otherDeductions:'otherDeductions',advancePaid:'advancePaid',otherPaid:'otherPaid',
  hazardPct:'hazardPct',taskPct:'taskPct',servicePct:'servicePct',qualityPct:'qualityPct',professionalPct:'professionalPct',
  productivityPct:'productivityPct',productionBonusPct:'productionBonusPct',nightPct:'nightPct',eveningPct:'eveningPct'
};
let shown = new Date(), selected = isoDate(new Date());
let data = loadData();

function loadData(){
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if(saved && saved.shifts && saved.leave) return {
      ...structuredClone(defaults), ...saved,
      salary:{...salaryDefaults,...(saved.salary||{})},
      payrollHistory:Array.isArray(saved.payrollHistory)?saved.payrollHistory:[],
      latestImportedRates:saved.latestImportedRates||null
    };
  } catch(e) {}
  return structuredClone(defaults);
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(e){$('status').textContent='Не удалось сохранить: возможно, в браузере закончилось место.';return false}}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fromIso(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function addDays(s,n){const d=fromIso(s);d.setDate(d.getDate()+n);return isoDate(d)}
function typeOf(s){if(data.leave.includes(s))return 'VACATION';return data.shifts[s]||'OFF'}
function label(t){return ({DAY:'ДЕНЬ',NIGHT:'НОЧЬ',OFF:'ВЫХОДНОЙ',VACATION:'ОТПУСК'})[t]||t}
function time(t){return t==='DAY'?'08:00–20:30 · 11,5 часа':t==='NIGHT'?'20:45–07:45 следующего дня · 10,5 часа':''}
function money(v){return MONEY.format(Number.isFinite(v)?v:0)}
function rub(v){return `${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v)} ₽`}
function round2(n){return Math.round((n+Number.EPSILON)*100)/100}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function render(){renderCalendar();renderNext();if($('dateInput').value!==selected)$('dateInput').value=selected;$('shiftInput').value=typeOf(selected);syncSalaryControls();renderSalary();renderHistory()}
function renderCalendar(){
  const y=shown.getFullYear(),m=shown.getMonth();$('monthTitle').textContent=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(shown);
  const g=$('calendar');g.innerHTML='';['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(x=>{const e=document.createElement('div');e.className='dow';e.textContent=x;g.append(e)});
  const first=new Date(y,m,1),offset=(first.getDay()+6)%7,n=new Date(y,m+1,0).getDate(),today=isoDate(new Date());
  for(let i=0;i<offset;i++)g.append(document.createElement('div'));
  for(let d=1;d<=n;d++){
    const s=isoDate(new Date(y,m,d)),t=typeOf(s),e=document.createElement('button');
    e.className='daycell '+({DAY:'day',NIGHT:'night',VACATION:'leave',OFF:''})[t]+(s===today?' today':'')+(s===selected?' selected':'');
    e.innerHTML=`<span class="num">${d}</span><span class="letter">${({DAY:'Д',NIGHT:'Н',VACATION:'О',OFF:'·'})[t]}</span>`;
    e.setAttribute('aria-label',`${d}: ${label(t)}`);e.onclick=()=>{selected=s;render()};g.append(e);
  }
}
function renderNext(){
  const now=new Date();let candidate=null;
  for(let i=0;i<370;i++){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i),s=isoDate(d),t=typeOf(s);if(t==='DAY'||t==='NIGHT'){candidate={d,s,t};break}}
  if(!candidate){$('nextLabel').textContent='БЛИЖАЙШАЯ СМЕНА';$('nextTitle').textContent='Смены не найдены';$('nextDate').textContent='Добавь смену в календаре';$('nextTime').textContent='';$('nextCountdown').textContent='';return}
  const {d,s,t}=candidate;$('nextLabel').textContent=s===isoDate(new Date())?'СМЕНА СЕГОДНЯ':'БЛИЖАЙШАЯ СМЕНА';$('nextTitle').textContent=label(t);$('nextDate').textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(d);$('nextTime').textContent=time(t);$('nextCountdown').textContent=t==='DAY'?'Перед сменой: подъём в 05:40':'Ночная смена заканчивается завтра в 07:45';
}
$('prevMonth').onclick=()=>{shown=new Date(shown.getFullYear(),shown.getMonth()-1,1);render()};
$('nextMonth').onclick=()=>{shown=new Date(shown.getFullYear(),shown.getMonth()+1,1);render()};
$('dateInput').onchange=()=>{selected=$('dateInput').value||selected;render()};
$('saveBtn').onclick=()=>{
  selected=$('dateInput').value||selected;const t=$('shiftInput').value;
  if(t==='VACATION'){if(!data.leave.includes(selected))data.leave.push(selected);delete data.shifts[selected]}
  else{data.leave=data.leave.filter(x=>x!==selected);if(t==='OFF')delete data.shifts[selected];else data.shifts[selected]=t}
  persist();render();$('status').textContent=`Сохранено: ${selected} — ${label(t)}.`;
};
$('resetBtn').onclick=()=>{if(confirm('Сбросить изменения графика и восстановить исходный график октября 2026?')){const sal=data.salary,history=data.payrollHistory,latest=data.latestImportedRates;data=structuredClone(defaults);data.salary=sal;data.payrollHistory=history;data.latestImportedRates=latest;persist();render();$('status').textContent='Исходный график восстановлен; зарплатные параметры и история сохранены.'}};
function monthShiftCounts(){
  const y=shown.getFullYear(),m=shown.getMonth(),n=new Date(y,m+1,0).getDate();let day=0,night=0,leave=0,off=0;
  for(let d=1;d<=n;d++){const t=typeOf(isoDate(new Date(y,m,d)));if(t==='DAY')day++;else if(t==='NIGHT')night++;else if(t==='VACATION')leave++;else off++}
  return {day,night,leave,off,year:y,month:m};
}
function syncSalaryControls(){
  const s=data.salary;$('salaryProfile').value=s.profile||'sep';
  $('salaryProfile').querySelector('option[value="latest"]').disabled=!data.latestImportedRates;
  for(const [id,key] of Object.entries(SALARY_FIELDS)){const el=$(id);if(el&&document.activeElement!==el)el.value=(s[key]??0)}
}

function calculateSalary(config, dayCount, nightCount, opts={}){
  const s={...salaryDefaults,...config};
  const tariff=Math.max(0,Number(s.tariff)||0),dayHours=Math.max(0,Number(s.dayHours)||0),nightHours=Math.max(0,Number(s.nightShiftHours)||0);
  const scheduledHours=dayCount*dayHours+nightCount*nightHours;
  const useOverride=!opts.forceScheduleHours && Number(s.hoursOverride)>0;
  const paidHours=useOverride?Number(s.hoursOverride):scheduledHours;
  const nightPremiumHours=(!opts.forceScheduleHours&&Number(s.nightPremiumHoursOverride)>0)?Number(s.nightPremiumHoursOverride):nightCount*Math.max(0,Number(s.nightPremiumPerShift)||0);
  const eveningPremiumHours=(!opts.forceScheduleHours&&Number(s.eveningPremiumHoursOverride)>0)?Number(s.eveningPremiumHoursOverride):nightCount*Math.max(0,Number(s.eveningPremiumPerShift)||0);
  const baseRaw=tariff*paidHours;
  const line=(title,amount,kind='')=>({title,amount:round2(amount),kind});
  const lines=[
    line('Повременная оплата по тарифу',baseRaw),
    line('Доплата за вредность',baseRaw*(Number(s.hazardPct)||0)/100),
    line('Надбавка за нормированное задание',baseRaw*(Number(s.taskPct)||0)/100),
    line('Надбавка за эффективное оказание услуг',baseRaw*(Number(s.servicePct)||0)/100),
    line('Надбавка за высокое качество труда',baseRaw*(Number(s.qualityPct)||0)/100),
    line('Доплата за профмастерство',baseRaw*(Number(s.professionalPct)||0)/100),
    line('Надбавка за плановую производительность',baseRaw*(Number(s.productivityPct)||0)/100),
    line('Премия производственная',baseRaw*(Number(s.productionBonusPct)||0)/100),
    line('Ночные с учётом доплат',tariff*nightPremiumHours*(Number(s.nightPct)||0)/100),
    line('Вечерние',tariff*eveningPremiumHours*(Number(s.eveningPct)||0)/100)
  ];
  const vacation=Math.max(0,Number(s.vacationPay)||0);if(vacation)lines.push(line('Отпускные / разовые начисления',vacation,'special'));
  const gross=round2(lines.reduce((a,x)=>a+x.amount,0));
  const taxableBenefit=Math.max(0,Number(s.taxableBenefit)||0);
  const tax=Math.round((gross+taxableBenefit)*(Math.max(0,Number(s.taxRate)||0)/100));
  const union=round2(gross*Math.max(0,Number(s.unionRate)||0)/100);
  const food=round2(Math.max(0,Number(s.mealDeduction)||0));
  const other=round2(Math.max(0,Number(s.otherDeductions)||0));
  const deductions=round2(tax+union+food+other),net=round2(gross-deductions);
  const paid=round2(Math.max(0,Number(s.advancePaid)||0)+Math.max(0,Number(s.otherPaid)||0));
  return {scheduledHours,paidHours,nightPremiumHours,eveningPremiumHours,lines,gross,tax,union,food,other,deductions,net,paid,balance:round2(net-paid),taxableBenefit};
}
function getSalaryResult(){const c=monthShiftCounts();return {...calculateSalary(data.salary,c.day,c.night),c}}
function dedupeModels(models){
  const found=new Map();
  for(const p of models){if(!p||!Number(p.tariff))continue;const k=['tariff','hazardPct','taskPct','servicePct','qualityPct','professionalPct','productivityPct','productionBonusPct','nightPct','eveningPct','mealDeduction','taxableBenefit'].map(x=>Number(p[x]||0).toFixed(3)).join('|');found.set(k,p)}
  return [...found.values()];
}
function forecastScenarios(c){
  const sources=[...Object.values(PAYROLL_PROFILES)];
  for(const h of data.payrollHistory||[])if(h.rates)sources.push(h.rates);
  const models=dedupeModels(sources);
  const predictions=models.map(p=>{
    const config={...data.salary,...p,vacationPay:0,hoursOverride:0,nightPremiumHoursOverride:0,eveningPremiumHoursOverride:0,advancePaid:0,otherPaid:0,otherDeductions:0};
    return calculateSalary(config,c.day,c.night,{forceScheduleHours:true}).net;
  }).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!predictions.length)return {low:0,mid:0,high:0,count:0};
  const middle=Math.floor(predictions.length/2),mid=predictions.length%2?predictions[middle]:(predictions[middle-1]+predictions[middle])/2;
  return {low:predictions[0],mid,high:predictions[predictions.length-1],count:predictions.length};
}
function renderSalary(){
  const r=getSalaryResult();
  $('salaryMonth').textContent=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(shown);
  $('salaryGross').textContent=money(r.gross);$('salaryNet').textContent=money(r.net);$('salaryDeductions').textContent=money(r.deductions);$('salaryBalance').textContent=money(r.balance);
  $('salaryShiftCounts').textContent=`Смены: ${r.c.day} дневн. · ${r.c.night} ночн. · отпускных дней: ${r.c.leave} · выходных: ${r.c.off}. Оплачиваемые часы: ${NUMBER.format(r.paidHours)} ч${Number(data.salary.hoursOverride)>0?' (введены вручную)':' (оценка по графику)'}. Оценка часов ночных доплат: ${NUMBER.format(r.nightPremiumHours)} ч; вечерних: ${NUMBER.format(r.eveningPremiumHours)} ч.`;
  const rows=[...r.lines,{title:'Всего начислено',amount:r.gross,total:true},{title:`НДФЛ ${NUMBER.format(Number(data.salary.taxRate)||0)}% от начислений + ${money(r.taxableBenefit)} дохода за питание`,amount:r.tax,minus:true},{title:`Профсоюзные взносы ${NUMBER.format(Number(data.salary.unionRate)||0)}%`,amount:r.union,minus:true},{title:'Удержание за питание',amount:r.food,minus:true},{title:'Прочие удержания',amount:r.other,minus:true},{title:'Всего удержано по модели',amount:r.deductions,total:true},{title:'Прогноз на руки за месяц',amount:r.net,total:true},{title:'Уже получено (аванс + другие выплаты)',amount:r.paid,minus:true},{title:'Остаток после уже полученных сумм',amount:r.balance,total:true}];
  $('salaryBreakdown').innerHTML=rows.map(x=>`<div class="breakdown-row ${x.total?'total':''} ${x.minus?'minus':''}"><span>${escapeHtml(x.title)}</span><strong>${money(x.amount)}</strong></div>`).join('');
  const sc=forecastScenarios(r.c);$('forecastLow').textContent=money(sc.low);$('forecastMid').textContent=money(sc.mid);$('forecastHigh').textContent=money(sc.high);
  $('rangeSource').textContent=`${sc.count} набора коэффициентов из доступных профилей; разовые отпускные исключены. Это сценарный диапазон, а не гарантия выплаты.`;
  const dayConfig={...data.salary,hoursOverride:0};const addDay=calculateSalary(dayConfig,r.c.day+1,r.c.night,{forceScheduleHours:true}).net-calculateSalary(dayConfig,r.c.day,r.c.night,{forceScheduleHours:true}).net;
  const addNight=calculateSalary({...data.salary,hoursOverride:0,nightPremiumHoursOverride:0,eveningPremiumHoursOverride:0},r.c.day,r.c.night+1,{forceScheduleHours:true}).net-calculateSalary({...data.salary,hoursOverride:0,nightPremiumHoursOverride:0,eveningPremiumHoursOverride:0},r.c.day,r.c.night,{forceScheduleHours:true}).net;
  $('dayShiftDelta').textContent='+'+money(addDay);$('nightShiftDelta').textContent='+'+money(addNight);
  const warnings=[];
  if(r.c.leave>0&&Number(data.salary.vacationPay)===0)warnings.push('В месяце есть отпуск: отпускные не рассчитываются автоматически и не включены в прогноз.');
  if(Number(data.salary.hoursOverride)>0)warnings.push('Использованы фактические часы вместо количества смен календаря.');
  warnings.push('Премии и доплаты зависят от фактических условий месяца; сверяй прогноз с листком работодателя.');
  $('salaryStatus').textContent=warnings.join(' ');
}
function applySalaryProfile(profile){
  let p=PAYROLL_PROFILES[profile];
  if(profile==='latest')p=data.latestImportedRates;
  if(!p){$('salaryStatus').textContent='Сначала загрузи хотя бы один расчётный листок, чтобы использовать его коэффициенты.';syncSalaryControls();return}
  const s=data.salary;const preserve={dayHours:s.dayHours,nightShiftHours:s.nightShiftHours,hoursOverride:s.hoursOverride,nightPremiumPerShift:s.nightPremiumPerShift,eveningPremiumPerShift:s.eveningPremiumPerShift,nightPremiumHoursOverride:s.nightPremiumHoursOverride,eveningPremiumHoursOverride:s.eveningPremiumHoursOverride,vacationPay:s.vacationPay,advancePaid:s.advancePaid,otherPaid:s.otherPaid,otherDeductions:s.otherDeductions,taxRate:s.taxRate,unionRate:s.unionRate};
  Object.assign(s,p,preserve,{profile});persist();syncSalaryControls();renderSalary();$('salaryStatus').textContent=profile==='latest'?'Коэффициенты перенесены из последней загруженной платёжки. Отпускные и разовые выплаты не добавлены автоматически.':`Загружены коэффициенты профиля ${profile.toUpperCase()}. Отпускные и суммы уже полученных выплат нужно проверить отдельно.`;
}
$('salaryProfile').onchange=()=>applySalaryProfile($('salaryProfile').value);
for(const [id,key] of Object.entries(SALARY_FIELDS)){
  $(id).addEventListener('input',()=>{data.salary[key]=Number($(id).value)||0;data.salary.profile='manual';$('salaryProfile').value='manual';persist();renderSalary()});
}
$('saveSalaryBtn').onclick=()=>{persist();$('salaryStatus').textContent='Параметры расчёта зарплаты сохранены на этом устройстве.'};
$('resetSalaryBtn').onclick=()=>{const old=data.salary;data.salary={...salaryDefaults,...PAYROLL_PROFILES.sep,profile:'sep',dayHours:old.dayHours,nightShiftHours:old.nightShiftHours,hoursOverride:0,nightPremiumPerShift:old.nightPremiumPerShift,eveningPremiumPerShift:old.eveningPremiumPerShift,nightPremiumHoursOverride:0,eveningPremiumHoursOverride:0,vacationPay:0,taxRate:13,unionRate:1,otherDeductions:0,advancePaid:old.advancePaid,otherPaid:old.otherPaid};persist();syncSalaryControls();renderSalary();$('salaryStatus').textContent='Коэффициенты сентября восстановлены; суммы уже полученных выплат сохранены.'};

// Local payslip parser: keep only anonymized monthly summaries and derived coefficients.
function parseMoney(value){
  if(value===null||value===undefined)return 0;
  let s=String(value).replace(/\u00a0/g,' ').replace(/₽/g,'').replace(/руб\.?/gi,'').replace(/\s/g,'').replace(/'/g,'').replace(/’/g,'').replace(/,/g,'.');
  const matches=s.match(/-?\d+(?:\.\d+)?/g);return matches&&matches.length?Number(matches[matches.length-1]):0;
}
function cellTexts(tr){return [...tr.querySelectorAll('td,th')].map(td=>(td.textContent||'').replace(/\s+/g,' ').trim())}
function findRowTotal(doc,needle){
  const rows=[...doc.querySelectorAll('tr')];const tr=rows.find(r=>(r.textContent||'').replace(/\s+/g,' ').toLowerCase().includes(needle.toLowerCase()));
  if(!tr)return 0;const cells=cellTexts(tr);for(let i=cells.length-1;i>=0;i--){const n=parseMoney(cells[i]);if(n!==0)return n}return 0;
}
function monthFromHtml(text){const match=text.toLowerCase().match(/за\s+(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)\s+месяц\s+(20\d{2})/);if(!match)return null;return `${match[2]}-${String(MONTHS.indexOf(match[1])+1).padStart(2,'0')}`}
function moneyFromMatch(text,regex){const m=text.match(regex);return m?parseMoney(m[1]):0}
function extractTimeHours(text,labelText){const idx=text.toLowerCase().indexOf(labelText.toLowerCase());if(idx<0)return 0;const tail=text.slice(idx,idx+220);const m=tail.match(/([\d]+(?:[.,][\d]+)?)\s*ч\.?/i);return m?parseMoney(m[1]):0}
function parseTableLines(doc,headerPhrase){
  const out=[];
  for(const tr of doc.querySelectorAll('tr')){
    const cells=cellTexts(tr);if(!cells.length)continue;
    if(cells.some(c=>c.toLowerCase().includes(headerPhrase.toLowerCase())))continue;
    if(cells.length<5)continue;
    const name=cells[4]||'';
    if(!name||/^(НАЧИСЛЕНО|УДЕРЖАНО|ПЕРЕЧИСЛЕНО|К ВЫДАЧЕ|ВСЕГО ДОЛГА)/i.test(name))continue;
    const amount=parseMoney(cells[cells.length-1]);
    if(amount===0&&!/0[.,]00/.test(cells[cells.length-1]||''))continue;
    out.push({period:cells[0]||'',days:parseMoney(cells[1]),hours:parseMoney(cells[2]),code:cells[3]||'',name:name.trim(),amount});
  }
  return out;
}
function allCategoryRows(doc){
  const categories={earnings:[],deductions:[],payments:[]};let mode='';
  for(const tr of doc.querySelectorAll('tr')){
    const cells=cellTexts(tr);if(!cells.length)continue;const joined=cells.join(' ').toLowerCase();
    if(joined.includes('наименование вида оплат')){mode='earnings';continue}
    if(joined.includes('наименование вида удержаний')){mode='deductions';continue}
    if(joined.includes('наименование вида перечислений')){mode='payments';continue}
    if(!mode||cells.length<5)continue;
    const name=cells[4]||'';
    if(!name||/^(НАЧИСЛЕНО|УДЕРЖАНО|ПЕРЕЧИСЛЕНО|К ВЫДАЧЕ|ВСЕГО ДОЛГА|СУММА, НЕ ОБЛАГАЕМАЯ|ФОНД ВРЕМЕНИ|ФАКТИЧЕСКИ ОТРАБОТАНО|ОПЛАЧИВАЕМОЕ ВРЕМЯ)/i.test(name))continue;
    const amount=parseMoney(cells[cells.length-1]);
    if(amount===0&&!/0[.,]00/.test(cells[cells.length-1]||''))continue;
    categories[mode].push({period:cells[0]||'',days:parseMoney(cells[1]),hours:parseMoney(cells[2]),code:cells[3]||'',name:name.trim(),amount});
  }
  return categories;
}
function sumWhere(rows,regex){return round2(rows.filter(r=>regex.test(r.name)).reduce((a,r)=>a+r.amount,0))}
function rateFrom(base,amount){return base>0?Math.round((amount/base*100+Number.EPSILON)*10)/10:0}
function inferRates(record, earningRows, deductionRows){
  const base=record.tariff*record.hours;
  const find=regex=>sumWhere(earningRows,regex);
  const nightPay=find(/ночные с учетом доплат|ночные с учётом доплат/i),eveningPay=find(/вечерние/i);
  const nightHours=sumWhere(earningRows.filter(x=>/ночные с учетом доплат|ночные с учётом доплат/i.test(x.name)),/.*/); // count rows only; numeric field assigned below
  const nightRow=earningRows.find(x=>/ночные с учетом доплат|ночные с учётом доплат/i.test(x.name));
  const eveningRow=earningRows.find(x=>/вечерние/i.test(x.name));
  const rates={
    tariff:record.tariff,
    hazardPct:rateFrom(base,find(/доплата за вредность/i)),
    taskPct:rateFrom(base,find(/надбавка за выполнение нормированного задания/i)),
    servicePct:rateFrom(base,find(/надбавка за эффективное оказание услуг/i)),
    qualityPct:rateFrom(base,find(/надбавка за высокое качество труда/i)),
    professionalPct:rateFrom(base,find(/доплата за проф\. мастерство|доплата за профессиональное мастерство/i)),
    productivityPct:rateFrom(base,find(/надбавка за достижение плановой производительности труда/i)),
    productionBonusPct:rateFrom(base,find(/премия производственная/i)),
    nightPct:nightRow&&nightRow.hours>0?rateFrom(record.tariff*nightRow.hours,nightPay):118,
    eveningPct:eveningRow&&eveningRow.hours>0?rateFrom(record.tariff*eveningRow.hours,eveningPay):59,
    taxableBenefit:record.taxableBenefit,
    mealDeduction:record.mealDeduction,
    unionRate:record.gross>0?rateFrom(record.gross,record.union):1
  };
  return rates;
}
async function parsePayslipFile(file){
  const raw=await file.arrayBuffer();let bytes=new Uint8Array(raw);let text=new TextDecoder('utf-8').decode(bytes);
  if((text.match(/�/g)||[]).length>4)text=new TextDecoder('windows-1251').decode(bytes);
  const doc=new DOMParser().parseFromString(text,'text/html');const bodyText=(doc.body?.textContent||'').replace(/\s+/g,' ');
  const month=monthFromHtml(bodyText);if(!month)throw new Error('Не найден месяц расчётного листка.');
  let tariff=0;
  for(const tr of doc.querySelectorAll('tr')){const c=cellTexts(tr);if(c.join(' ').toLowerCase().includes('тарифная ставка/оклад')){tariff=parseMoney(c[c.length-1]);break}}
  const categories=allCategoryRows(doc),earnings=categories.earnings,deductionsRows=categories.deductions,payments=categories.payments;
  const gross=findRowTotal(doc,'НАЧИСЛЕНО...');
  const withheld=findRowTotal(doc,'УДЕРЖАНО...');
  const paid=findRowTotal(doc,'ПЕРЕЧИСЛЕНО\\ВЫПЛАЧЕНО')||findRowTotal(doc,'ПЕРЕЧИСЛЕНО/ВЫПЛАЧЕНО')||round2(payments.reduce((a,x)=>a+x.amount,0));
  let hours=extractTimeHours(bodyText,'ОПЛАЧИВАЕМОЕ ВРЕМЯ');if(!hours)hours=extractTimeHours(bodyText,'ФАКТИЧЕСКИ ОТРАБОТАНО ВРЕМЕНИ');
  if(!hours){const ordinary=earnings.find(x=>/повременная оплата по тарифным ставкам/i.test(x.name));hours=ordinary?.hours||0}
  const nightRow=earnings.find(x=>/ночные с учетом доплат|ночные с учётом доплат/i.test(x.name));
  const eveningRow=earnings.find(x=>/вечерние/i.test(x.name));
  const tax=sumWhere(deductionsRows,/подоходный налог/i),mealDeduction=sumWhere(deductionsRows,/^за питание$/i),union=sumWhere(deductionsRows,/профсоюзные взносы/i);
  let taxableBenefit=findRowTotal(doc,'НЕНАЧИСЛЯЕМЫЙ ДОХОД...');if(!taxableBenefit)taxableBenefit=sumWhere(earnings,/для удержания подоходного за обеды/i);
  const otherDeductions=round2(Math.max(0,withheld-tax-mealDeduction-union));
  const vacationEarnings=sumWhere(earnings,/отпуск/i),advance=sumWhere(payments,/аванс/i),salaryPayment=sumWhere(payments,/перечисление зарплаты/i),vacationPayment=sumWhere(payments,/отпускн/i);
  if(!(tariff>0&&gross>0&&withheld>=0))throw new Error('Не удалось найти тариф или итог начислений/удержаний.');
  const record={month,tariff:round2(tariff),hours:round2(hours),nightHours:round2(nightRow?.hours||0),nightPay:round2(nightRow?.amount||0),eveningHours:round2(eveningRow?.hours||0),eveningPay:round2(eveningRow?.amount||0),gross:round2(gross),deductions:round2(withheld),paid:round2(paid),net:round2(gross-withheld),tax:round2(tax),union:round2(union),mealDeduction:round2(mealDeduction),taxableBenefit:round2(taxableBenefit),otherDeductions,vacationEarnings:round2(vacationEarnings),advance:round2(advance),salaryPayment:round2(salaryPayment),vacationPayment:round2(vacationPayment)};
  record.netPerHour=record.hours>0?round2(record.net/record.hours):0;
  record.rates=inferRates(record,earnings,deductionsRows);
  record.specialMonth=record.vacationEarnings>0;
  return record;
}
$('importPayrollBtn').onclick=async()=>{
  const files=[...($('payrollFiles').files||[])];if(!files.length){$('historyStatus').textContent='Сначала выбери один или несколько HTML-файлов.';return}
  $('importPayrollBtn').disabled=true;$('historyStatus').textContent=`Разбираю файлов: ${files.length}…`;
  let good=0;const errors=[];
  for(const file of files){
    try{
      let parsedRecords=[];
      if(file.name.toLowerCase().endsWith('.json')){
        const obj=JSON.parse(await file.text());
        const source=Array.isArray(obj)?obj:(obj&&Array.isArray(obj.payrollHistory)?obj.payrollHistory:null);
        if(!source)throw new Error('В JSON не найдена сводная история платёжек.');
        parsedRecords=source.map(sanitizeHistoryRecord).filter(Boolean);
        if(!parsedRecords.length)throw new Error('В JSON нет корректных записей месяцев.');
      } else parsedRecords=[await parsePayslipFile(file)];
      for(const parsed of parsedRecords){const old=(data.payrollHistory||[]).findIndex(x=>x.month===parsed.month);if(old>=0)data.payrollHistory.splice(old,1);data.payrollHistory.push(parsed);good++}
    }catch(e){errors.push(`${file.name}: ${e.message||'ошибка разбора'}`)}
  }
  data.payrollHistory.sort((a,b)=>a.month.localeCompare(b.month));
  if(data.payrollHistory.length){const latest=data.payrollHistory[data.payrollHistory.length-1];data.latestImportedRates=latest.rates;applySalaryProfile('latest')}
  persist();render();$('payrollFiles').value='';$('importPayrollBtn').disabled=false;
  $('historyStatus').textContent=`Добавлено/обновлено: ${good}. В истории всего месяцев: ${data.payrollHistory.length}.`+(errors.length?' Ошибки: '+errors.join(' · '):'');
};
function sanitizeHistoryRecord(h){
  if(!h||!/^\d{4}-\d{2}$/.test(String(h.month||''))||!(Number(h.gross)>0))return null;
  const numeric=['tariff','hours','nightHours','nightPay','eveningHours','eveningPay','gross','deductions','paid','net','netPerHour','tax','union','mealDeduction','taxableBenefit','otherDeductions','vacationEarnings','advance','salaryPayment','vacationPayment'];
  const out={month:String(h.month),specialMonth:Boolean(h.specialMonth),rates:h.rates&&typeof h.rates==='object'?h.rates:null};
  for(const key of numeric)out[key]=Number(h[key])||0;
  if(!out.net)out.net=round2(out.gross-out.deductions);
  if(!out.netPerHour&&out.hours>0)out.netPerHour=round2(out.net/out.hours);
  if(!out.rates){out.rates={...PAYROLL_PROFILES.sep,tariff:out.tariff||162.9,mealDeduction:out.mealDeduction,taxableBenefit:out.taxableBenefit,unionRate:out.gross>0?rateFrom(out.gross,out.union):1}}
  return out;
}
function renderHistory(){
  const history=(data.payrollHistory||[]).slice().sort((a,b)=>a.month.localeCompare(b.month));
  $('historyCount').textContent=`${history.length} ${history.length===1?'месяц':history.length>=2&&history.length<=4?'месяца':'месяцев'}`;
  const tbody=$('historyRows');
  if(!history.length){tbody.innerHTML='<tr><td colspan="7">Пока нет загруженных расчётных листков.</td></tr>';$('historySummary').textContent='Добавь платёжки, чтобы получить статистику на основе фактических начислений.';return}
  tbody.innerHTML=history.map(h=>`<tr><td>${escapeHtml(h.month)}${h.specialMonth?' *':''}</td><td>${NUMBER.format(h.hours)}</td><td>${NUMBER.format(h.nightHours)}</td><td>${money(h.gross)}</td><td>${money(h.deductions)}</td><td>${money(h.paid)}</td><td>${h.hours>0?money(h.net/h.hours):'—'}</td></tr>`).join('');
  const regular=history.filter(h=>!h.specialMonth&&h.hours>0),average=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
  const avgGross=average(regular.map(h=>h.gross)),avgNet=average(regular.map(h=>h.net)),avgHours=average(regular.map(h=>h.hours)),avgRate=average(regular.map(h=>h.net/h.hours));
  $('historySummary').innerHTML=`<div class="history-kpis"><div><span>Обычных месяцев</span><strong>${regular.length}</strong></div><div><span>Среднее начислено</span><strong>${money(avgGross)}</strong></div><div><span>Среднее на руки</span><strong>${money(avgNet)}</strong></div><div><span>Средняя выплата за час</span><strong>${money(avgRate)}</strong></div></div><p class="hint">Средние считаются без месяцев с отдельными отпускными начислениями. Среднее число часов за обычный месяц: ${NUMBER.format(avgHours)}. Месяцы со специальными выплатами помечены звёздочкой (*).</p>`;
}
$('clearHistoryBtn').onclick=()=>{if(confirm('Удалить из приложения всю сохранённую историю платёжек и их коэффициенты? Исходные файлы не затрагиваются.')){data.payrollHistory=[];data.latestImportedRates=null;persist();renderHistory();syncSalaryControls();renderSalary();$('historyStatus').textContent='История платёжек удалена с этого устройства.'}};
$('exportHistoryBtn').onclick=()=>{
  const rows=[['Месяц','Тариф ₽/ч','Часы','Ночные часы','Вечерние часы','Начислено ₽','Удержано ₽','Выплачено ₽','На руки ₽','На руки ₽/ч','Отпускные в начислениях ₽']];
  for(const h of (data.payrollHistory||[]))rows.push([h.month,h.tariff,h.hours,h.nightHours,h.eveningHours,h.gross,h.deductions,h.paid,h.net,h.netPerHour,h.vacationEarnings]);
  const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');downloadFile(csv,'История_зарплаты.csv','text/csv;charset=utf-8');
};

function downloadFile(content,filename,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('backupBtn').onclick=()=>downloadFile(JSON.stringify(data,null,2),'Резервная_копия_графика_и_зарплаты.json','application/json;charset=utf-8');
$('restoreInput').onchange=async()=>{
  const f=$('restoreInput').files?.[0];if(!f)return;
  try{const obj=JSON.parse(await f.text());if(!obj||!obj.shifts||!Array.isArray(obj.leave)||!obj.salary)throw new Error('Файл не похож на резервную копию этого приложения.');
    data={...structuredClone(defaults),...obj,salary:{...salaryDefaults,...obj.salary},payrollHistory:Array.isArray(obj.payrollHistory)?obj.payrollHistory:[],latestImportedRates:obj.latestImportedRates||null};persist();render();$('status').textContent='Резервная копия восстановлена.';
  }catch(e){$('status').textContent=e.message||'Не удалось прочитать файл резервной копии.'}finally{$('restoreInput').value=''}
};

$('exportBtn').onclick=()=>{
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Мой рабочий график//RU','CALSCALE:GREGORIAN','X-WR-CALNAME:Мой рабочий график'];
  const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
  const add=(uid,title,start,end,desc,alarm)=>{lines.push('BEGIN:VEVENT',`UID:${uid}@work-schedule`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`SUMMARY:${esc(title)}`,`DTSTART:${start}`,`DTEND:${end}`,`DESCRIPTION:${esc(desc)}`);if(alarm)lines.push('BEGIN:VALARM',`TRIGGER:${alarm}`,'ACTION:DISPLAY',`DESCRIPTION:${esc(title)}`,'END:VALARM');lines.push('END:VEVENT')};
  const start=new Date();
  for(let i=-1;i<370;i++){const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),s=isoDate(d),t=typeOf(s),compact=s.replaceAll('-','');
    if(t==='DAY'){add('day-'+s,'Дневная смена',compact+'T080000',compact+'T203000','08:00–20:30; 11,5 оплачиваемого часа','-PT15M');const p=new Date(d);p.setDate(p.getDate()-1);const ps=isoDate(p).replaceAll('-','');add('prep-'+s,'Подготовиться к дневной смене',ps+'T230000',ps+'T230500','Завтра дневная смена; подъём 05:40','PT0M');add('wake-'+s,'Подъём в 05:40',compact+'T054000',compact+'T054500','Дневная смена начинается в 08:00','PT0M')}
    else if(t==='NIGHT'){const end=new Date(d);end.setDate(end.getDate()+1);add('night-'+s,'Ночная смена',compact+'T204500',isoDate(end).replaceAll('-','')+'T074500','20:45–07:45 следующего дня; 10,5 оплачиваемого часа','-PT15M')}
  }
  const a=[...data.leave].sort();if(a.length){let b=a[0],last=b;for(const s of [...a.slice(1),null]){if(s&&s===addDays(last,1)){last=s;continue}add('leave-'+b,'Отпуск',b.replaceAll('-',''),addDays(last,1).replaceAll('-',''),'Отпуск; рабочие смены не планируются');if(s)b=last=s}}
  lines.push('END:VCALENDAR');downloadFile(lines.join('\r\n')+'\r\n','Мой_рабочий_график.ics','text/calendar;charset=utf-8');$('status').textContent='Файл календаря подготовлен.';
};
$('notifyBtn').onclick=async()=>{
  if(!('Notification'in window)){$('status').textContent='Этот браузер не поддерживает уведомления. Для графика используй экспорт .ics.';return}
  try{const p=await Notification.requestPermission();$('status').textContent=p==='granted'?'Разрешение получено. Регулярные напоминания не гарантируются, когда приложение закрыто; системный будильник надёжнее.':'Уведомления не разрешены.';if(p==='granted')new Notification('Мой рабочий график',{body:'Разрешение на уведомления включено.'})}catch(e){$('status').textContent='Не удалось запросить разрешение уведомлений.'}
};
let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installBtn').classList.remove('hidden')});
$('installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installBtn').classList.add('hidden')}};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
