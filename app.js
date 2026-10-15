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
  profile:'sep', tariff:162.90, dayHours:11.5, nightShiftHours:10.5, hoursOverride:0, otherBonusPct:0,
  nightPremiumPerShift:8.95, eveningPremiumPerShift:1.5, nightPremiumHoursOverride:0, eveningPremiumHoursOverride:0,
  vacationPay:0, taxableBenefit:2329, taxRate:13, unionRate:1, mealDeduction:3026,
  otherDeductions:0, advancePaid:0, otherPaid:0, ...PAYROLL_PROFILES.sep
};
const defaults = {leave:[],shifts:{},salary:{...salaryDefaults},payrollHistory:[],latestImportedRates:null,classifications:{},pendingModelProposal:null};
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
  productivityPct:'productivityPct',productionBonusPct:'productionBonusPct',nightPct:'nightPct',eveningPct:'eveningPct',otherBonusPct:'otherBonusPct'
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
      latestImportedRates:saved.latestImportedRates||null,
      classifications:saved.classifications&&typeof saved.classifications==='object'?saved.classifications:{},
      pendingModelProposal:saved.pendingModelProposal||null
    };
  } catch(e) {}
  return structuredClone(defaults);
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(e){$('status').textContent='Не удалось сохранить: возможно, в браузере закончилось место.';return false}}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fromIso(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function addDays(s,n){const d=fromIso(s);d.setDate(d.getDate()+n);return isoDate(d)}
function typeOf(s){if(data.leave.includes(s))return 'VACATION';return data.shifts[s]||'OFF'}
function calendarSnapshot(month){
  const [y,m]=month.split('-').map(Number),n=new Date(y,m,0).getDate();let day=0,night=0;
  for(let d=1;d<=n;d++){const t=typeOf(`${month}-${String(d).padStart(2,'0')}`);if(t==='DAY')day++;else if(t==='NIGHT')night++}
  return {day,night,hours:day*(Number(data.salary.dayHours)||0)+night*(Number(data.salary.nightShiftHours)||0)};
}
function cycleDate(s){const t=typeOf(s);if(t==='VACATION'){$('status').textContent='Отпуск меняется в блоке «Изменить дату».';return false}const nx=t==='DAY'?'NIGHT':t==='NIGHT'?'OFF':'DAY';if(nx==='OFF')delete data.shifts[s];else data.shifts[s]=nx;persist();render();$('status').textContent=`${s}: ${label(nx)}. Повторный тап по выбранной дате меняет смену.`;return true}
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
    e.setAttribute('aria-label',`${d}: ${label(t)}`);e.onclick=()=>{if(s===selected&&cycleDate(s))return;selected=s;render()};g.append(e);
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
$('resetBtn').onclick=()=>{if(confirm('Очистить весь график (смены и отпуск)?')){const sal=data.salary,history=data.payrollHistory,latest=data.latestImportedRates,classifications=data.classifications,pending=data.pendingModelProposal;data=structuredClone(defaults);data.salary=sal;data.payrollHistory=history;data.latestImportedRates=latest;data.classifications=classifications||{};data.pendingModelProposal=pending||null;persist();render();$('status').textContent='График очищен; зарплатные параметры, история и классификации сохранены.'}};
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
    line('Прочие регулярные начисления (по классификации)',baseRaw*(Number(s.otherBonusPct)||0)/100),
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
  for(const p of models){if(!p||!Number(p.tariff))continue;const k=['tariff','hazardPct','taskPct','servicePct','qualityPct','professionalPct','productivityPct','productionBonusPct','nightPct','eveningPct','mealDeduction','taxableBenefit','taxRate','otherBonusPct','otherDeductions'].map(x=>Number(p[x]||0).toFixed(3)).join('|');found.set(k,p)}
  return [...found.values()];
}
function forecastScenarios(c){
  const regular=(data.payrollHistory||[]).filter(h=>!h.specialMonth&&h.hours>0&&h.rates);
  const sources=regular.length>=2?regular.map(h=>({...h.rates,tariff:h.tariff||h.rates.tariff})):([...Object.values(PAYROLL_PROFILES),...regular.map(h=>h.rates)]);
  const models=dedupeModels(sources);
  const predictions=models.map(p=>{
    const config={...data.salary,...p,vacationPay:0,hoursOverride:0,nightPremiumHoursOverride:0,eveningPremiumHoursOverride:0,advancePaid:0,otherPaid:0,otherDeductions:0};
    return calculateSalary(config,c.day,c.night,{forceScheduleHours:true}).net;
  }).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!predictions.length)return {low:0,mid:0,high:0,count:0,sourceCount:0};
  const middle=Math.floor(predictions.length/2),mid=predictions.length%2?predictions[middle]:(predictions[middle-1]+predictions[middle])/2;
  return {low:predictions[0],mid,high:predictions[predictions.length-1],count:predictions.length,sourceCount:regular.length};
}
function renderSalary(){
  const r=getSalaryResult();
  $('salaryMonth').textContent=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(shown);
  $('salaryGross').textContent=money(r.gross);$('salaryNet').textContent=money(r.net);$('salaryDeductions').textContent=money(r.deductions);$('salaryBalance').textContent=money(r.balance);
  $('salaryShiftCounts').textContent=`Смены: ${r.c.day} дневн. · ${r.c.night} ночн. · отпускных дней: ${r.c.leave} · выходных: ${r.c.off}. Оплачиваемые часы: ${NUMBER.format(r.paidHours)} ч${Number(data.salary.hoursOverride)>0?' (введены вручную)':' (оценка по графику)'}. Оценка часов ночных доплат: ${NUMBER.format(r.nightPremiumHours)} ч; вечерних: ${NUMBER.format(r.eveningPremiumHours)} ч.`;
  const rows=[...r.lines,{title:'Всего начислено',amount:r.gross,total:true},{title:`НДФЛ ${NUMBER.format(Number(data.salary.taxRate)||0)}% от начислений + ${money(r.taxableBenefit)} дохода за питание`,amount:r.tax,minus:true},{title:`Профсоюзные взносы ${NUMBER.format(Number(data.salary.unionRate)||0)}%`,amount:r.union,minus:true},{title:'Удержание за питание',amount:r.food,minus:true},{title:'Прочие удержания',amount:r.other,minus:true},{title:'Всего удержано по модели',amount:r.deductions,total:true},{title:'Прогноз на руки за месяц',amount:r.net,total:true},{title:'Уже получено (аванс + другие выплаты)',amount:r.paid,minus:true},{title:'Остаток после уже полученных сумм',amount:r.balance,total:true}];
  $('salaryBreakdown').innerHTML=rows.map(x=>`<div class="breakdown-row ${x.total?'total':''} ${x.minus?'minus':''}"><span>${escapeHtml(x.title)}</span><strong>${money(x.amount)}</strong></div>`).join('');
  const sc=forecastScenarios(r.c);$('forecastLow').textContent=money(sc.low);$('forecastMid').textContent=money(sc.mid);$('forecastHigh').textContent=money(sc.high);
  $('rangeSource').textContent=sc.sourceCount>=2?`${sc.sourceCount} обычных месяцев из загруженной истории; месяцы с разовыми начислениями исключены. Это сценарный диапазон, а не гарантия выплаты.`:`Пока недостаточно обычных месяцев (${sc.sourceCount}); диапазон дополняется стартовыми профилями. Это сценарный диапазон, а не гарантия выплаты.`;
  const dayConfig={...data.salary,hoursOverride:0};const addDay=calculateSalary(dayConfig,r.c.day+1,r.c.night,{forceScheduleHours:true}).net-calculateSalary(dayConfig,r.c.day,r.c.night,{forceScheduleHours:true}).net;
  const addNight=calculateSalary({...data.salary,hoursOverride:0,nightPremiumHoursOverride:0,eveningPremiumHoursOverride:0},r.c.day,r.c.night+1,{forceScheduleHours:true}).net-calculateSalary({...data.salary,hoursOverride:0,nightPremiumHoursOverride:0,eveningPremiumHoursOverride:0},r.c.day,r.c.night,{forceScheduleHours:true}).net;
  $('dayShiftDelta').textContent='+'+money(addDay);$('nightShiftDelta').textContent='+'+money(addNight);
  const warnings=[];
  if(r.c.leave>0&&Number(data.salary.vacationPay)===0)warnings.push('В месяце есть отпуск: отпускные не рассчитываются автоматически и не включены в прогноз (если их выплатили в прошлом месяце, так и должно быть).');
  if(Number(data.salary.hoursOverride)>0)warnings.push('Использованы фактические часы вместо количества смен календаря.');
  warnings.push('Премии и доплаты зависят от фактических условий месяца; сверяй прогноз с листком работодателя.');
  const regularHistory=(data.payrollHistory||[]).filter(h=>!h.specialMonth&&h.hours>0);
  if(regularHistory.length<3)warnings.push(`В модели только ${regularHistory.length} обычных месяцев: точность пока ограничена.`);
  const advs=[...new Set((data.payrollHistory||[]).filter(h=>!h.specialMonth&&h.advance>0).map(h=>Math.round(h.advance)))].sort((x,y)=>x-y);
  if(advs.length){const lo=advs[0],hi=advs[advs.length-1];let t=`Выплаты: аванс 25-го обычно ${rub(lo)}${hi!==lo?' или '+rub(hi):''}; остаток 10-го следующего месяца ≈ ${rub(r.net-hi)}${hi!==lo?'–'+rub(r.net-lo):''}.`;if(r.c.leave>0)t+=' В месяце есть отпуск — аванс может отличаться.';warnings.push(t)}
  $('salaryStatus').textContent=warnings.join(' ');
}
function applySalaryProfile(profile){
  let p=PAYROLL_PROFILES[profile];
  if(profile==='latest')p=data.latestImportedRates;
  if(profile==='history'){if(data.pendingModelProposal){renderModelReview();$('salaryStatus').textContent='Предложение модели находится в разделе проверки ниже; примени его отдельной кнопкой.';return}const proposal=makeModelProposal();if(!proposal||!Object.keys(proposal.values||{}).length){$('salaryStatus').textContent='Недостаточно сопоставимых месяцев для модели по истории. Добавь обычные платёжки.';syncSalaryControls();return}data.pendingModelProposal=proposal;persist();renderModelReview();$('salaryStatus').textContent='Модель из истории подготовлена как предложение. Подтверди её в разделе проверки модели.';return}
  if(!p){$('salaryStatus').textContent='Сначала загрузи хотя бы один расчётный листок, чтобы использовать его коэффициенты.';syncSalaryControls();return}
  const s=data.salary;const preserve={dayHours:s.dayHours,nightShiftHours:s.nightShiftHours,hoursOverride:s.hoursOverride,nightPremiumPerShift:s.nightPremiumPerShift,eveningPremiumPerShift:s.eveningPremiumPerShift,nightPremiumHoursOverride:s.nightPremiumHoursOverride,eveningPremiumHoursOverride:s.eveningPremiumHoursOverride,vacationPay:s.vacationPay,advancePaid:s.advancePaid,otherPaid:s.otherPaid,otherDeductions:s.otherDeductions,taxRate:s.taxRate,unionRate:s.unionRate};
  Object.assign(s,p,preserve,{profile});if(data.pendingModelProposal)data.pendingModelProposal=makeModelProposal();persist();syncSalaryControls();renderSalary();renderModelReview();$('salaryStatus').textContent=profile==='latest'?'Коэффициенты перенесены из последней загруженной платёжки по твоему выбору. Отпускные и разовые выплаты не добавлены автоматически.':`Загружены коэффициенты профиля ${profile.toUpperCase()}. Отпускные и суммы уже полученных выплат нужно проверить отдельно.`;
}
$('salaryProfile').onchange=()=>applySalaryProfile($('salaryProfile').value);
for(const [id,key] of Object.entries(SALARY_FIELDS)){
  $(id).addEventListener('input',()=>{data.salary[key]=Number($(id).value)||0;data.salary.profile='manual';$('salaryProfile').value='manual';if(data.pendingModelProposal)data.pendingModelProposal=makeModelProposal();persist();renderSalary();renderModelReview()});
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
  const categories={earnings:[],deductions:[],payments:[]};
  for(const table of doc.querySelectorAll('table')){
    let mode='';
    for(const tr of table.querySelectorAll('tr')){
      const cells=cellTexts(tr);if(!cells.length)continue;const joined=cells.join(' ').toLowerCase();
      if(joined.includes('наименование вида оплат')){mode='earnings';continue}
      if(joined.includes('наименование вида удержаний')){mode='deductions';continue}
      if(joined.includes('наименование вида перечислений')){mode='payments';continue}
      if(!mode||cells.length<5)continue;
      const name=cells[4]||'';
      if(!name)continue;
      if(/^(НАЧИСЛЕНО|УДЕРЖАНО|ПЕРЕЧИСЛЕНО|К ВЫДАЧЕ|ВСЕГО ДОЛГА|СУММА, НЕ ОБЛАГАЕМАЯ|ФОНД ВРЕМЕНИ|ФАКТИЧЕСКИ ОТРАБОТАНО|ОПЛАЧИВАЕМОЕ ВРЕМЯ)/i.test(name)){mode='';continue}
      const amount=parseMoney(cells[cells.length-1]);
      if(amount===0&&!/0[.,]00/.test(cells[cells.length-1]||''))continue;
      categories[mode].push({period:cells[0]||'',days:parseMoney(cells[1]),hours:parseMoney(cells[2]),code:cells[3]||'',name:name.trim(),amount});
    }
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
    unionRate:record.gross>0?rateFrom(record.gross,record.union):1,
    taxRate:(record.gross+record.taxableBenefit)>0?rateFrom(record.gross+record.taxableBenefit,record.tax):13,
    otherBonusPct:0
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
  record.hasLineItems=true;
  record.lineItems=[...earnings.map(x=>({...x,mode:'earnings'})),...deductionsRows.map(x=>({...x,mode:'deductions'}))].map(x=>({mode:x.mode,name:x.name,amount:round2(x.amount),hours:round2(x.hours||0),code:String(x.code||'')}));
  const evidence={tariff:true};
  const evidenceMatchers={hazardPct:/доплата за вредность/i,taskPct:/надбавка за выполнение нормированного задания/i,servicePct:/надбавка за эффективное оказание услуг/i,qualityPct:/надбавка за высокое качество труда/i,professionalPct:/доплата за проф\.? мастерство|доплата за профессиональное мастерство/i,productivityPct:/надбавка за достижение плановой производительности труда/i,productionBonusPct:/премия производственная/i};
  for(const [key,rx] of Object.entries(evidenceMatchers))evidence[key]=earnings.some(x=>rx.test(x.name));
  evidence.nightPct=Boolean(nightRow&&nightRow.hours>0);evidence.eveningPct=Boolean(eveningRow&&eveningRow.hours>0);evidence.taxRate=tax>0;evidence.unionRate=union>0;evidence.mealDeduction=mealDeduction>0;evidence.taxableBenefit=taxableBenefit>0;
  record.observedRates=evidence;
  record.netPerHour=record.hours>0?round2(record.net/record.hours):0;
  record.rates=inferRates(record,earnings,deductionsRows);
  record.specialMonth=record.vacationEarnings>0;
  return record;
}
const MODEL_FIELDS={
  tariff:{label:'Тариф, ₽/ч',min:1,precision:2},
  hazardPct:{label:'Вредность, %',min:2,precision:1},
  taskPct:{label:'Нормированное задание, %',min:2,precision:1},
  servicePct:{label:'Эффективное оказание услуг, %',min:2,precision:1},
  qualityPct:{label:'Высокое качество, %',min:2,precision:1},
  professionalPct:{label:'Профмастерство, %',min:2,precision:1},
  productivityPct:{label:'Плановая производительность, %',min:2,precision:1},
  productionBonusPct:{label:'Производственная премия, %',min:2,precision:1},
  nightPct:{label:'Ночные с доплатами, %',min:2,precision:1},
  eveningPct:{label:'Вечерние, %',min:2,precision:1},
  taxRate:{label:'НДФЛ по наблюдаемым строкам, %',min:2,precision:1},
  unionRate:{label:'Профсоюзные взносы, %',min:2,precision:1},
  mealDeduction:{label:'Удержание за питание, ₽',min:2,precision:2},
  taxableBenefit:{label:'Доход за питание для НДФЛ, ₽',min:2,precision:2},
  otherBonusPct:{label:'Прочие классифицированные начисления, %',min:2,precision:1},
  otherDeductions:{label:'Регулярные классифицированные удержания, ₽',min:2,precision:2}
};
const LINE_CATEGORIES=[
  ['regularBonus','Регулярная надбавка'],['oneOffEarning','Разовое начисление'],
  ['regularDeduction','Регулярное удержание'],['oneOffDeduction','Разовое удержание'],
  ['ignore','Не учитывать в модели']
];
function classKey(mode,name){return `${mode}::${String(name||'').replace(/\s+/g,' ').trim().toLowerCase()}`}
function knownLine(name,mode){
  const n=String(name||'').toLowerCase();
  if(mode==='earnings'){
    if(/повременная оплата по тарифным ставкам|доплата за вредность|надбавка за выполнение нормированного задания|надбавка за эффективное оказание услуг|надбавка за высокое качество труда|доплата за проф\.? мастерство|доплата за профессиональное мастерство|надбавка за достижение плановой производительности труда|премия производственная|ночные с учетом доплат|ночные с учётом доплат|вечерние/i.test(n))return 'known';
    if(/отпуск|больничн|материальн.*помощ|разов.*прем/i.test(n))return 'oneOffEarning';
  }
  if(mode==='deductions'){
    if(/подоходный налог|профсоюзные взносы|^за питание$|налог/i.test(n))return 'known';
    if(/брак|штраф|разов.*удерж/i.test(n))return 'oneOffDeduction';
  }
  return 'unknown';
}
function classifyLine(name,mode){
  const k=classKey(mode,name);if(Object.prototype.hasOwnProperty.call(data.classifications||{},k))return data.classifications[k];
  return knownLine(name,mode);
}
function median(nums){const a=nums.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function lineClassSum(h,mode,cat){return (h.lineItems||[]).filter(x=>x.mode===mode&&classifyLine(x.name,mode)===cat).reduce((a,x)=>a+(Number(x.amount)||0),0)}
function observedValue(h,key){
  const base=(Number(h.tariff)||0)*(Number(h.hours)||0);const r=h.rates||{};const evidence=h.observedRates||null;
  if(key==='tariff')return Number(h.tariff)>0?Number(h.tariff):null;
  if(key==='otherBonusPct'){
    const anyMapped=(data.payrollHistory||[]).some(rec=>(rec.lineItems||[]).some(x=>x.mode==='earnings'&&classifyLine(x.name,'earnings')==='regularBonus'));
    if(!anyMapped||!h.hasLineItems||base<=0)return null;
    return lineClassSum(h,'earnings','regularBonus')/base*100;
  }
  if(key==='otherDeductions'){
    const anyMapped=(data.payrollHistory||[]).some(rec=>(rec.lineItems||[]).some(x=>x.mode==='deductions'&&classifyLine(x.name,'deductions')==='regularDeduction'));
    if(!anyMapped||!h.hasLineItems)return null;
    return lineClassSum(h,'deductions','regularDeduction');
  }
  if(key==='taxRate'){return Number(h.tax)>0&&Number(h.gross)+Number(h.taxableBenefit)>0?Number(h.tax)/(Number(h.gross)+Number(h.taxableBenefit))*100:null}
  if(key==='unionRate'){return Number(h.union)>0&&Number(h.gross)>0?Number(h.union)/Number(h.gross)*100:(Number(r.unionRate)>0?Number(r.unionRate):null)}
  if(key==='mealDeduction')return Number(h.mealDeduction)>0?Number(h.mealDeduction):null;
  if(key==='taxableBenefit')return Number(h.taxableBenefit)>0?Number(h.taxableBenefit):null;
  if(evidence){
    if(key==='nightPct'&&!evidence[key])return null;
    if(key==='eveningPct'&&!evidence[key])return null;
    const n=Number(r[key]);
    if(['hazardPct','taskPct','servicePct','qualityPct','professionalPct','productivityPct','productionBonusPct'].includes(key))return evidence[key]?n:0;
    return evidence[key]&&Number.isFinite(n)?n:null;
  }
  if(key==='nightPct'&&!(Number(h.nightHours)>0))return null;
  if(key==='eveningPct'&&!(Number(h.eveningHours)>0))return null;
  const n=Number(r[key]);
  if(['hazardPct','taskPct','servicePct','qualityPct','professionalPct','productivityPct','productionBonusPct'].includes(key))return Number.isFinite(n)&&n>=0?n:null;
  return Number.isFinite(n)&&n>0?n:null;
}
function makeModelProposal(){
  const regular=(data.payrollHistory||[]).filter(h=>!h.specialMonth&&Number(h.hours)>0);
  const values={},evidence={},changes=[];
  for(const [key,meta] of Object.entries(MODEL_FIELDS)){
    const pairs=regular.map(h=>({month:h.month,value:observedValue(h,key)})).filter(x=>x.value!==null&&Number.isFinite(x.value));
    evidence[key]=pairs;
    if(pairs.length<meta.min)continue;
    const raw=median(pairs.map(x=>x.value));if(raw===null)continue;
    const rounder=10**meta.precision;values[key]=Math.round((raw+Number.EPSILON)*rounder)/rounder;
  }
  for(const [key,value] of Object.entries(values)){
    const old=Number(data.salary[key]||0),diff=value-old;
    if(Math.abs(diff)>Math.max(0.05,Math.abs(old)*0.001))changes.push({key,label:MODEL_FIELDS[key].label,old,value,diff,count:evidence[key].length,months:evidence[key].map(x=>x.month)});
  }
  const n=regular.length;return {values,evidence,changes,regularMonths:regular.map(h=>h.month),createdAt:new Date().toISOString(),confidence:n>=6?'средняя/хорошая':n>=3?'средняя':'низкая'};
}
function valueForUI(key,value){return key.toLowerCase().includes('pct')||key==='taxRate'||key==='unionRate'?`${NUMBER.format(value)}%`:key==='tariff'||key==='mealDeduction'||key==='taxableBenefit'||key==='otherDeductions'?money(value):NUMBER.format(value)}
function renderModelReview(){
  const panel=$('modelReviewPanel');if(!panel)return;
  const proposal=data.pendingModelProposal;
  if(!proposal){panel.classList.add('hidden');return}
  panel.classList.remove('hidden');
  const changes=(proposal.changes||[]);let html=`<p class="hint">В модель войдут только параметры, подтверждённые минимум двумя обычными месяцами (для тарифа достаточно одного). Месяцы с отпускными исключены. Уровень уверенности по имеющейся истории: <strong>${escapeHtml(proposal.confidence||'низкая')}</strong>.</p>`;
  if(changes.length){html+='<div class="table-wrap"><table class="payroll-table review-table"><thead><tr><th>Параметр</th><th>Сейчас</th><th>По истории</th><th>Источники</th></tr></thead><tbody>'+changes.map(c=>`<tr><td>${escapeHtml(c.label)}</td><td>${escapeHtml(valueForUI(c.key,c.old))}</td><td><strong>${escapeHtml(valueForUI(c.key,c.value))}</strong></td><td>${c.count}: ${escapeHtml(c.months.join(', '))}</td></tr>`).join('')+'</tbody></table></div>'}
  else html+='<p>Подтверждённых изменений нет. Добавь ещё обычные месяцы или проверь классификацию новых строк.</p>';
  const notEnough=Object.entries(MODEL_FIELDS).filter(([key,m])=>(proposal.evidence?.[key]||[]).length>0&&(proposal.evidence[key].length<m.min));
  if(notEnough.length)html+=`<p class="hint">Пока мало наблюдений для: ${notEnough.map(([k,m])=>`${escapeHtml(m.label)} (${(proposal.evidence[k]||[]).length}/${m.min})`).join('; ')}. Эти параметры автоматически не меняются.</p>`;
  html+='<div class="history-actions"><button id="applyModelProposalBtn" class="primary">Применить предложенные параметры</button><button id="dismissModelProposalBtn" class="secondary">Оставить текущую модель</button></div>';
  $('modelReviewContent').innerHTML=html;
  $('applyModelProposalBtn').onclick=()=>{
    const p=data.pendingModelProposal;if(!p)return;const preserve=['dayHours','nightShiftHours','hoursOverride','nightPremiumPerShift','eveningPremiumPerShift','nightPremiumHoursOverride','eveningPremiumHoursOverride','vacationPay','advancePaid','otherPaid'];
    const keep={};preserve.forEach(k=>keep[k]=data.salary[k]);Object.assign(data.salary,p.values,keep,{profile:'history'});data.pendingModelProposal=null;persist();render();$('salaryStatus').textContent='Подтверждённые коэффициенты обновлены по истории. Разовые выплаты и фактически полученные суммы сохранены отдельно.';$('historyStatus').textContent='Модель обновлена вручную после просмотра предложения.';
  };
  $('dismissModelProposalBtn').onclick=()=>{data.pendingModelProposal=null;persist();renderModelReview();$('historyStatus').textContent='Предложение отклонено. Текущая модель оставлена без изменений.'};
}
function renderUnknownLines(){
  const box=$('unclassifiedLines');if(!box)return;const found=new Map();
  for(const h of data.payrollHistory||[])for(const item of (h.lineItems||[])){
    const mode=item.mode||'earnings';if(classifyLine(item.name,mode)!=='unknown')continue;
    const key=classKey(mode,item.name);if(!found.has(key))found.set(key,{key,mode,name:item.name,count:0,amount:0,months:new Set()});const x=found.get(key);x.count++;x.amount+=Number(item.amount)||0;x.months.add(h.month);
  }
  const list=[...found.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  if(!list.length){box.innerHTML='<p class="hint">Нераспознанных строк нет. Если импортирован JSON-сводка без исходных строк, новые категории появятся после импорта HTML-платёжки.</p>';return}
  box.innerHTML=`<p class="hint">Эти строки не включаются в расчётную модель автоматически. Выбери категорию для каждой строки; после сохранения пересчитается предложение модели.</p>`+list.map((x,i)=>{const allowed=LINE_CATEGORIES.filter(([v])=>x.mode==='earnings'?['regularBonus','oneOffEarning','ignore'].includes(v):['regularDeduction','oneOffDeduction','ignore'].includes(v));return `<div class="unknown-item"><div class="unknown-text"><strong>${escapeHtml(x.name)}</strong><small>${x.mode==='earnings'?'Начисление':'Удержание'} · ${x.count} строк · ${money(x.amount)} суммарно · ${escapeHtml([...x.months].join(', '))}</small></div><div class="unknown-controls"><select data-class-key="${escapeHtml(x.key)}" aria-label="Классификация строки ${escapeHtml(x.name)}"><option value="">Не классифицировать</option>${allowed.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><button data-save-class="${escapeHtml(x.key)}" class="secondary">Сохранить</button></div></div>`}).join('');
  for(const x of list){const sel=[...box.querySelectorAll('select[data-class-key]')].find(el=>el.dataset.classKey===x.key);if(sel)sel.value=data.classifications[x.key]||'';const btn=[...box.querySelectorAll('button[data-save-class]')].find(el=>el.dataset.saveClass===x.key);if(btn)btn.onclick=()=>{const select=[...box.querySelectorAll('select[data-class-key]')].find(el=>el.dataset.classKey===x.key);const val=select?.value;if(!val){$('historyStatus').textContent='Выбери категорию перед сохранением.';return}data.classifications[x.key]=val;data.pendingModelProposal=makeModelProposal();persist();renderHistory();renderModelReview();$('historyStatus').textContent=`Строка «${x.name}» классифицирована: ${LINE_CATEGORIES.find(c=>c[0]===val)?.[1]||val}. Проверь предложение модели.`};}
}
function compareRecordToModel(h){
  if(h.specialMonth||!(Number(h.hours)>0))return null;
  const conf={...data.salary,hoursOverride:Number(h.hours),nightPremiumHoursOverride:Number(h.nightHours)||0,eveningPremiumHoursOverride:Number(h.eveningHours)||0,vacationPay:0,advancePaid:0,otherPaid:0};
  const result=calculateSalary(conf,0,0);return {gross:result.gross,net:result.net,grossDelta:result.gross-Number(h.gross),netDelta:result.net-Number(h.net)};
}
function walkForwardMAE(){
  const reg=(data.payrollHistory||[]).filter(h=>!h.specialMonth&&Number(h.hours)>0),errs=[];
  for(let i=3;i<reg.length;i++){
    const cfg={...data.salary,vacationPay:0,advancePaid:0,otherPaid:0};
    for(const [key,meta] of Object.entries(MODEL_FIELDS)){const vals=reg.slice(0,i).map(h=>observedValue(h,key)).filter(v=>v!==null&&Number.isFinite(v));if(vals.length>=meta.min)cfg[key]=median(vals)}
    const h=reg[i];errs.push(calculateSalary({...cfg,hoursOverride:h.hours,nightPremiumHoursOverride:Number(h.nightHours)||0,eveningPremiumHoursOverride:Number(h.eveningHours)||0},0,0).net-h.net);
  }
  return errs.length?{n:errs.length,mae:errs.reduce((x,y)=>x+Math.abs(y),0)/errs.length}:null;
}
function modelAccuracy(){
  const xs=(data.payrollHistory||[]).filter(h=>!h.specialMonth&&Number(h.hours)>0).map(h=>({h,c:compareRecordToModel(h)})).filter(x=>x.c);
  if(!xs.length)return {n:0,grossMAE:0,netMAE:0};
  const avg=(key)=>xs.reduce((a,x)=>a+Math.abs(x.c[key]),0)/xs.length;
  return {n:xs.length,grossMAE:avg('grossDelta'),netMAE:avg('netDelta')};
}

async function importPayrollFiles(fileList){
  const files=[...fileList];
  if(!files.length){$('historyStatus').textContent='Файл не выбран. Нажми кнопку импорта и выбери JSON или HTML-платёжку.';return}
  const button=$('importPayrollBtn'),input=$('payrollFiles');
  button.disabled=true;button.textContent='Импортирую…';
  $('historyStatus').textContent=`Разбираю файлов: ${files.length}…`;
  let good=0;const errors=[];
  try{
    for(const file of files){
      try{
        let parsedRecords=[];
        if(file.name.toLowerCase().endsWith('.json') || file.type==='application/json'){
          const obj=JSON.parse(await file.text());
          const source=Array.isArray(obj)?obj:(obj&&Array.isArray(obj.payrollHistory)?obj.payrollHistory:null);
          if(!source)throw new Error('В JSON не найдена сводная история платёжек. Ожидается поле payrollHistory.');
          parsedRecords=source.map(sanitizeHistoryRecord).filter(Boolean);
          if(!parsedRecords.length)throw new Error('В JSON нет корректных записей месяцев.');
        } else parsedRecords=[await parsePayslipFile(file)];
        for(const parsed of parsedRecords){
          const old=(data.payrollHistory||[]).findIndex(x=>x.month===parsed.month);
          const oldRec=old>=0?data.payrollHistory[old]:null;if(old>=0)data.payrollHistory.splice(old,1);
          const prev=old>=0?oldRec:null;const sn=calendarSnapshot(parsed.month);
          if(sn.day+sn.night>0&&!parsed.scheduledHours){parsed.shiftDay=sn.day;parsed.shiftNight=sn.night;parsed.scheduledHours=sn.hours}
          else if(prev&&prev.scheduledHours&&!parsed.scheduledHours){parsed.shiftDay=prev.shiftDay;parsed.shiftNight=prev.shiftNight;parsed.scheduledHours=prev.scheduledHours}
          data.payrollHistory.push(parsed);good++;
        }
      }catch(e){errors.push(`${file.name}: ${e.message||'ошибка разбора'}`)}
    }
    data.payrollHistory.sort((a,b)=>a.month.localeCompare(b.month));
    if(data.payrollHistory.length){const latest=data.payrollHistory[data.payrollHistory.length-1];data.latestImportedRates=latest.rates;data.pendingModelProposal=makeModelProposal()}
    persist();render();renderModelReview();renderUnknownLines();
    $('historyStatus').textContent=`Импорт завершён. Добавлено/обновлено записей: ${good}. В истории всего месяцев: ${data.payrollHistory.length}. Текущие коэффициенты не менялись: проверь предложение ниже.`+(errors.length?' Ошибки: '+errors.join(' · '):good?'':' Не удалось импортировать файлы. Проверь, что выбран файл .json или исходный расчётный листок .html.');
  }catch(e){$('historyStatus').textContent=`Ошибка импорта: ${e.message||e}`}
  finally{input.value='';button.disabled=false;button.textContent='Импортировать платёжки / JSON-историю'}
}
$('importPayrollBtn').onclick=()=>{
  const files=[...($('payrollFiles').files||[])];
  if(!files.length){$('historyStatus').textContent='Сейчас откроется выбор файла. Выбери JSON-историю или HTML-платёжки.';$('payrollFiles').click();return}
  importPayrollFiles(files);
};
$('payrollFiles').addEventListener('change',()=>{
  const files=[...($('payrollFiles').files||[])];
  if(files.length)importPayrollFiles(files);
});
function sanitizeHistoryRecord(h){
  if(!h||!/^\d{4}-\d{2}$/.test(String(h.month||''))||!(Number(h.gross)>0))return null;
  const numeric=['tariff','hours','nightHours','nightPay','eveningHours','eveningPay','gross','deductions','paid','net','netPerHour','tax','union','mealDeduction','taxableBenefit','otherDeductions','vacationEarnings','advance','salaryPayment','vacationPayment','scheduledHours','shiftDay','shiftNight'];
  const out={month:String(h.month),specialMonth:Boolean(h.specialMonth),rates:h.rates&&typeof h.rates==='object'?h.rates:null,observedRates:h.observedRates&&typeof h.observedRates==='object'?h.observedRates:null,hasLineItems:Boolean(h.hasLineItems||Array.isArray(h.lineItems)),lineItems:Array.isArray(h.lineItems)?h.lineItems.filter(x=>x&&x.name).map(x=>({mode:x.mode==='deductions'?'deductions':'earnings',name:String(x.name),amount:Number(x.amount)||0,hours:Number(x.hours)||0,code:String(x.code||'')})):[]};
  for(const key of numeric)out[key]=Number(h[key])||0;
  if(!out.net)out.net=round2(out.gross-out.deductions);
  if(!out.netPerHour&&out.hours>0)out.netPerHour=round2(out.net/out.hours);
  if(!out.rates){out.rates={...PAYROLL_PROFILES.sep,tariff:out.tariff||162.9,mealDeduction:out.mealDeduction,taxableBenefit:out.taxableBenefit,unionRate:out.gross>0?rateFrom(out.gross,out.union):1}}
  if(!out.rates.otherBonusPct)out.rates.otherBonusPct=0;
  if(!out.rates.taxRate&&out.gross+out.taxableBenefit>0)out.rates.taxRate=out.tax/(out.gross+out.taxableBenefit)*100;
  return out;
}
function renderHistory(){
  const history=(data.payrollHistory||[]).slice().sort((a,b)=>a.month.localeCompare(b.month));
  $('historyCount').textContent=`${history.length} ${history.length===1?'месяц':history.length>=2&&history.length<=4?'месяца':'месяцев'}`;
  const tbody=$('historyRows');
  if(!history.length){tbody.innerHTML='<tr><td colspan="9">Пока нет загруженных расчётных листков.</td></tr>';$('historySummary').textContent='Добавь платёжки, чтобы получить статистику на основе фактических начислений.';renderModelReview();renderUnknownLines();return}
  tbody.innerHTML=history.map(h=>{const cmp=compareRecordToModel(h);return `<tr><td>${escapeHtml(h.month)}${h.specialMonth?' *':''}</td><td>${NUMBER.format(h.hours)}</td><td>${NUMBER.format(h.nightHours)}</td><td>${money(h.gross)}</td><td>${money(h.deductions)}</td><td>${money(h.paid)}</td><td>${h.hours>0?money(h.net/h.hours):'—'}</td><td>${cmp?money(cmp.net):'—'}</td><td>${cmp?(cmp.netDelta>0?'+':'')+money(cmp.netDelta):'разовый месяц'}</td></tr>`}).join('');
  const regular=history.filter(h=>!h.specialMonth&&h.hours>0),average=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
  const avgGross=average(regular.map(h=>h.gross)),avgNet=average(regular.map(h=>h.net)),avgHours=average(regular.map(h=>h.hours)),avgRate=average(regular.map(h=>h.net/h.hours));
  const acc=modelAccuracy(),wf=walkForwardMAE(),cal=regular.filter(h=>h.scheduledHours>0),ratio=cal.length?average(cal.map(h=>h.hours/h.scheduledHours)):null;
  $('historySummary').innerHTML=`<div class="history-kpis"><div><span>Обычных месяцев</span><strong>${regular.length}</strong></div><div><span>Среднее начислено</span><strong>${money(avgGross)}</strong></div><div><span>Среднее на руки</span><strong>${money(avgNet)}</strong></div><div><span>Средняя выплата за час</span><strong>${money(avgRate)}</strong></div><div><span>Средняя ошибка начисления</span><strong>${acc.n?money(acc.grossMAE):'—'}</strong></div><div><span>Средняя ошибка «на руки»</span><strong>${acc.n?money(acc.netMAE):'—'}</strong></div><div><span>Ошибка на «новых» месяцах (честная)</span><strong>${wf?money(wf.mae):'—'}</strong></div><div><span>Часы: факт к графику</span><strong>${ratio?NUMBER.format(Math.round(ratio*1000)/10)+'%':'—'}</strong></div></div><p class="hint">Ошибки считаются сравнением текущей модели с обычными месяцами по фактическим часам; они не являются гарантией будущей точности. Средние считаются без месяцев с отпускными начислениями. Среднее число часов за обычный месяц: ${NUMBER.format(avgHours)}. Месяцы с разовыми начислениями помечены звёздочкой (*). «Факт к графику» считается по месяцам, которые были заполнены в календаре до импорта листка.</p>`;
  renderModelReview();renderUnknownLines();
}
$('clearHistoryBtn').onclick=()=>{if(confirm('Удалить из приложения всю сохранённую историю платёжек и их коэффициенты? Исходные файлы не затрагиваются.')){data.payrollHistory=[];data.latestImportedRates=null;data.pendingModelProposal=null;data.classifications={};if(data.salary.profile==='history'||data.salary.profile==='latest')data.salary.profile='manual';persist();renderHistory();syncSalaryControls();renderSalary();$('historyStatus').textContent='История платёжек удалена с этого устройства.'}};
$('exportHistoryBtn').onclick=()=>{
  const rows=[['Месяц','Тариф ₽/ч','Часы','Ночные часы','Вечерние часы','Начислено факт ₽','Удержано факт ₽','Выплачено ₽','На руки факт ₽','На руки факт ₽/ч','Прогноз на руки ₽','Разница к факту ₽','Отпускные в начислениях ₽']];
  for(const h of (data.payrollHistory||[])){const c=compareRecordToModel(h);rows.push([h.month,h.tariff,h.hours,h.nightHours,h.eveningHours,h.gross,h.deductions,h.paid,h.net,h.netPerHour,c?c.net:'',c?c.netDelta:'',h.vacationEarnings])}
  const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');downloadFile(csv,'История_зарплаты.csv','text/csv;charset=utf-8');
};

function downloadFile(content,filename,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('backupBtn').onclick=()=>{try{localStorage.setItem(KEY+'-backup',String(Date.now()))}catch(e){}downloadFile(JSON.stringify(data,null,2),'Резервная_копия_графика_и_зарплаты.json','application/json;charset=utf-8')};
$('restoreInput').onchange=async()=>{
  const f=$('restoreInput').files?.[0];if(!f)return;
  try{const obj=JSON.parse(await f.text());if(!obj||!obj.shifts||!Array.isArray(obj.leave)||!obj.salary)throw new Error('Файл не похож на резервную копию этого приложения.');
    data={...structuredClone(defaults),...obj,salary:{...salaryDefaults,...obj.salary},payrollHistory:Array.isArray(obj.payrollHistory)?obj.payrollHistory:[],latestImportedRates:obj.latestImportedRates||null,classifications:obj.classifications&&typeof obj.classifications==='object'?obj.classifications:{},pendingModelProposal:obj.pendingModelProposal||null};persist();render();$('status').textContent='Резервная копия восстановлена.';
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
const THEME_KEY='work-schedule-theme';
function applyTheme(t){const r=document.documentElement;if(t==='dark'||t==='light')r.dataset.theme=t;else delete r.dataset.theme;$('themeBtn').textContent={dark:'Тема: тёмная',light:'Тема: светлая'}[t]||'Тема: авто'}
function savedTheme(){try{return localStorage.getItem(THEME_KEY)||'auto'}catch(e){return 'auto'}}
$('themeBtn').onclick=()=>{const t=savedTheme(),nx=t==='auto'?'dark':t==='dark'?'light':'auto';try{localStorage.setItem(THEME_KEY,nx)}catch(e){}applyTheme(nx)};
applyTheme(savedTheme());
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
render();
try{const lb=Number(localStorage.getItem(KEY+'-backup'))||0;if(Date.now()-lb>30*864e5)$('status').textContent='Сделай резервную копию (кнопка бэкапа): данные хранятся только на этом устройстве.'}catch(e){}
