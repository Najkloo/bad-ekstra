(() => {
"use strict";
const $ = s => document.querySelector(s);
const state = {
  leagueId:null, teams:[], standings:[], fixtures:[], discipline:[],
  month:new Date(), selectedDate:new Date(), charts:{}, busy:false,
  seasonStart:null, seasonEnd:null, seasonMatches:[], seasonStatsLoaded:false,
  fixtureStats:new Map(), crestById:new Map(), seasonCardMatchTotals:[]
};
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { const n=Number(String(v??"").replace(",", ".")); return Number.isFinite(n)?n:0; };
const toast = msg => {const el=$("#toast");if(!el)return;el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),3600)};
const api = async path => {
  let r;
  try { r=await fetch(`${APP_CONFIG.API_BASE}${path}`,{method:"GET",headers:{"Accept":"application/json"}}); }
  catch { throw new Error("Nie udało się połączyć z Cloudflare Worker. Sprawdź połączenie internetowe."); }
  let j; try {j=await r.json();} catch {throw new Error(`Nieprawidłowa odpowiedź API (HTTP ${r.status}).`);}
  if(!r.ok || j.success===false) throw new Error(j.message||j.error||`Błąd API (${r.status}).`);
  return j;
};
const unwrap = j => Array.isArray(j?.data)?j.data:Array.isArray(j?.fixtures)?j.fixtures:Array.isArray(j?.response)?j.response:[];
const seasonStartDate = () => {const now=new Date();return new Date(now.getFullYear()-(now.getMonth()<6?1:0),6,1,12)};
const teamName = (v,fallback="—") => typeof v==="string"?v:(v?.name||v?.short_name||v?.display_name||fallback);
const teamId = v => {
  if (v == null || typeof v !== "object") return null;
  return v.id ?? v.team_id ?? v.team?.id ?? null;
};
const teamLogo = v => {
  if(!v||typeof v!=="object") return "";
  return v.logo_url||v.logo||v.image_url||v.image||v.crest||v.badge||v.photo||"";
};
const initials = name => String(name||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
const crest = (name,logo="",small=false) => `<span class="team-crest ${small?"small":""}">${logo?`<img src="${esc(logo)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.textContent='${esc(initials(name))}'">`:esc(initials(name))}</span>`;
const statusCode = f => String(f.status?.short||f.status?.code||f.status||"").toUpperCase();
const isDone = f => ["FT","AET","PENS","FINISHED","FULL_TIME","ENDED"].includes(statusCode(f));
const isLive = f => ["LIVE","1H","2H","HT","ET","P","IN_PLAY"].includes(statusCode(f)) || Boolean(f.minute);
const fixtureDateTime = f => f.datetime||f.date||f.start_time||"";
const fixtureId = f => f.id??f.fixture_id??f.match_id;
const fixtureTeams = f => {
  const homeObj=f.home||f.homeTeam|| (typeof f.home_team==="object"?f.home_team:null);
  const awayObj=f.away||f.awayTeam|| (typeof f.away_team==="object"?f.away_team:null);
  const homeName=teamName(homeObj,teamName(f.home_team,f.home_name||"Gospodarze"));
  const awayName=teamName(awayObj,teamName(f.away_team,f.away_name||"Goście"));
  const homeLogo=teamLogo(homeObj)||f.home_logo||f.home_team_logo||"";
  const awayLogo=teamLogo(awayObj)||f.away_logo||f.away_team_logo||"";
  const homeId=teamId(homeObj)??f.home_id??f.home_team_id;
  const awayId=teamId(awayObj)??f.away_id??f.away_team_id;
  return {homeName,awayName,homeLogo,awayLogo,homeId,awayId};
};
const score = (f,side) => f[`${side}_score`]??f.score?.[side]??f.goals?.[side]??"—";
function showError(message){
  toast(message);
  if($("#standings-body"))$("#standings-body").innerHTML=`<tr><td colspan="10" class="empty">${esc(message)}</td></tr>`;
  if($("#fixtures-list"))$("#fixtures-list").innerHTML=`<div class="empty">${esc(message)}</div>`;
}
async function findLeague(){
  const countries=unwrap(await api("/leagues"));let found=null;
  for(const c of countries){const leagues=c.leagues||[];found=leagues.find(l=>/ekstraklasa/i.test(l.name||"")&&/poland|polska/i.test(c.country||""))||found;}
  if(!found)for(const c of countries)found=(c.leagues||[]).find(l=>/ekstraklasa/i.test(l.name||""))||found;
  if(!found)throw new Error("Nie znaleziono Ekstraklasy na liście lig SportAPI.ai. Sprawdź dostępność ligi w panelu dostawcy.");
  state.leagueId=found.id;return found;
}
async function loadStandings(){
  const rows=unwrap(await api(`/standings/${state.leagueId}`));
  const flat=rows.length&&rows[0].table?rows.flatMap(g=>g.table||[]):rows;
  state.standings=flat;
  state.teams=flat.map(r=>r.team||r).filter(Boolean);
  state.teams.forEach(t=>{if(t.id&&teamLogo(t))state.crestById.set(String(t.id),teamLogo(t));});
  renderStandings();populateTeamSelects();
  $("#standings-updated").textContent=`Aktualizacja: ${new Date().toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"})}`;
}
function renderStandings(){
  const body=$("#standings-body");if(!state.standings.length){body.innerHTML='<tr><td colspan="10" class="empty">Brak danych tabeli w odpowiedzi API.</td></tr>';return;}
  body.innerHTML=state.standings.map((r,i)=>{
    const t=r.team||r,name=teamName(t),logo=teamLogo(t),gd=num(r.goals_for)-num(r.goals_against);
    const raw=r.form,formText=typeof raw==="string"?raw:Array.isArray(raw)?raw.map(x=>typeof x==="string"?x:(x?.result||x?.outcome||x?.status||"")).join(""):raw&&typeof raw==="object"?String(raw.form||raw.results||raw.value||""):"";
    const form=formText.slice(-5).split("").map(x=>`<i class="form-${String(x).toLowerCase()}">${esc(x)}</i>`).join("");
    return `<tr><td class="rank">${r.position||i+1}</td><td><div class="team-cell">${crest(name,logo)}<b>${esc(name)}</b></div></td><td>${num(r.played)}</td><td>${num(r.won)}</td><td>${num(r.draw)}</td><td>${num(r.lost)}</td><td>${num(r.goals_for)}:${num(r.goals_against)}</td><td class="${gd>0?"positive":gd<0?"negative":""}">${gd>0?"+":""}${gd}</td><td class="points">${num(r.points)}</td><td><div class="form-list">${form||"—"}</div></td></tr>`;
  }).join("");
}
function populateTeamSelects(){
  const opts=state.teams.map(t=>`<option value="${esc(t.id)}">${esc(teamName(t))}</option>`).join("");
  $("#home-team").innerHTML='<option value="">Wybierz drużynę</option>'+opts;
  $("#away-team").innerHTML='<option value="">Wybierz drużynę</option>'+opts;
}
function filterLeague(fixtures){return fixtures.filter(f=>!state.leagueId||Number(f.league_id??f.league?.id)===Number(state.leagueId));}
async function fixturesForDate(date){
  const j=await api(`/fixtures/date/${date}`);return filterLeague(unwrap(j));
}
async function loadFixtures(date){
  state.fixtures=await fixturesForDate(fmtDate(date));renderFixtures();renderCalendar();
}
function cardForecastForTeams(homeName, awayName){
  const norm=s=>String(s||"").trim().toLocaleLowerCase("pl-PL");
  const h=state.discipline.find(x=>norm(x.name)===norm(homeName));
  const a=state.discipline.find(x=>norm(x.name)===norm(awayName));
  if(!h||!a||!h.m||!a.m) return null;
  const lambda=Math.max(.1,(h.yAvg||0)+(a.yAvg||0));
  const pAtLeast=(k)=>{
    let term=Math.exp(-lambda),sum=term;
    for(let i=1;i<k;i++){term*=lambda/i;sum+=term;}
    return Math.max(0,Math.min(1,1-sum));
  };
  const high=pAtLeast(5), low=1-pAtLeast(4);
  const mid=Math.max(0,1-high-low);
  return {lambda,high,low,mid,sample:Math.min(h.m,a.m)};
}
function forecastMarkup(teams){
  const f=cardForecastForTeams(teams.homeName,teams.awayName);
  if(!f) return `<div class="fixture-forecast unavailable"><span class="forecast-label">PROGNOZA KARTEK</span><b>Brak wystarczających danych</b><small>Prognoza pojawi się po zebraniu statystyk sezonowych.</small></div>`;
  const pct=n=>`${Math.round(n*100)}%`;
  const category=f.high>=.55?"Wysokie prawdopodobieństwo":f.high>=.35?"Umiarkowane prawdopodobieństwo":"Niskie prawdopodobieństwo";
  const tone=f.high>=.55?"high":f.high>=.35?"medium":"low";
  return `<div class="fixture-forecast ${tone}">
    <div class="forecast-main"><span class="forecast-label">PROGNOZA ŻÓŁTYCH KARTEK</span><b>${category}</b><small>5 lub więcej kartek: ${pct(f.high)}</small></div>
    <div class="forecast-probs"><span><i class="dot low"></i> 0–3: <b>${pct(f.low)}</b></span><span><i class="dot mid"></i> 4: <b>${pct(f.mid)}</b></span><span><i class="dot high"></i> 5+: <b>${pct(f.high)}</b></span></div>
    <small class="forecast-source">Na podstawie ${f.sample} meczów z danymi dla każdej drużyny</small>
  </div>`;
}
function renderFixtures(){
  $("#fixtures-title").textContent=new Date(fmtDate(state.selectedDate)+"T12:00:00").toLocaleDateString("pl-PL",{day:"numeric",month:"long",year:"numeric"});
  $("#fixtures-subtitle").textContent="MECZE EKSTRAKLASY • PROGNOZA PRZEDMECZOWA";
  $("#fixture-count").textContent=`${state.fixtures.length} SPOTKAŃ`;
  const el=$("#fixtures-list");
  if(!state.fixtures.length){el.innerHTML='<div class="empty empty-large">Brak spotkań Ekstraklasy w tym dniu.<br><small>Wybierz inną datę w kalendarzu.</small></div>';return;}
  el.innerHTML=state.fixtures.map(f=>{
    const teams=fixtureTeams(f),live=isLive(f),done=isDone(f),dt=fixtureDateTime(f);
    const status=live?`<span class="match-live">${esc(f.minute?`${f.minute}'`:"NA ŻYWO")}</span>`:done?'<span class="match-done">ZAKOŃCZONY</span>':`<span class="match-time">${esc(String(dt).slice(11,16)||"—")}</span>`;
    const scoreText=done||live?`${esc(score(f,"home"))}<i>:</i>${esc(score(f,"away"))}`:"— : —";
    return `<article class="fixture-card" data-fixture-id="${esc(fixtureId(f))}">
      <div class="fixture-card-head"><span class="fixture-status">${status}</span><span class="fixture-round">${esc(f.round||f.matchday||f.stage||"PKO BP EKSTRAKLASA")}</span></div>
      <div class="fixture-main">
        <div class="fixture-team home">${crest(teams.homeName,teams.homeLogo||state.crestById.get(String(teams.homeId||"")),true)}<b>${esc(teams.homeName)}</b></div>
        <div class="fixture-score">${scoreText}</div>
        <div class="fixture-team away"><b>${esc(teams.awayName)}</b>${crest(teams.awayName,teams.awayLogo||state.crestById.get(String(teams.awayId||"")),true)}</div>
      </div>
      ${forecastMarkup(teams)}
    </article>`;
  }).join("");
}
async function getFixtureDiscipline(f){
  const id=fixtureId(f);
  let statsData=null, events=[];
  try {
    const j=await api(`/fixtures/${id}/stats`);
    const d=j.data||j.stats||j;
    if(j.available!==false && (d.home||d.away)) statsData=d;
  } catch(e) {}
  if(!statsData || statsData.home?.yellow_cards==null || statsData.away?.yellow_cards==null){
    try {
      const ej=await api(`/fixtures/${id}/events`);
      events=unwrap(ej);
    } catch(e) {}
  }
  const countEvents=(side,type) => events.filter(ev =>
    String(ev.team_side||ev.side||"").toLowerCase()===side &&
    String(ev.event_type||ev.type||"").toLowerCase().includes(type)
  ).length;
  const h=statsData?.home||{}, a=statsData?.away||{};
  const hY=h.yellow_cards ?? h.yellowCards ?? countEvents("home","yellow");
  const aY=a.yellow_cards ?? a.yellowCards ?? countEvents("away","yellow");
  const hR=h.red_cards ?? h.redCards ?? countEvents("home","red");
  const aR=a.red_cards ?? a.redCards ?? countEvents("away","red");
  const hF=h.fouls ?? h.total_fouls ?? null;
  const aF=a.fouls ?? a.total_fouls ?? null;
  const hasCards=events.length>0 || h.yellow_cards!=null || a.yellow_cards!=null || h.yellowCards!=null || a.yellowCards!=null;
  return {home:{...h,yellow_cards:Number(hY)||0,red_cards:Number(hR)||0,fouls:hF==null?null:Number(hF)},
          away:{...a,yellow_cards:Number(aY)||0,red_cards:Number(aR)||0,fouls:aF==null?null:Number(aF)},
          hasCards,hasFouls:hF!=null||aF!=null};
}
async function loadFixtureAnalysis(f){
  const id=fixtureId(f),target=$(`#fixture-analysis-${CSS.escape(String(id))}`);if(!target||!id)return;
  try{
    const d=await getFixtureDiscipline(f), h=d.home, a=d.away;
    if(!d.hasCards && !d.hasFouls){target.innerHTML='<span class="analysis-upcoming">Brak szczegółowych statystyk tego spotkania w SportAPI.ai.</span>';return;}
    const val=(v)=>v==null?"—":v;
    target.innerHTML=`<div class="analysis-stat"><span>🟨 Żółte kartki</span><b>${val(h.yellow_cards)} : ${val(a.yellow_cards)}</b></div><div class="analysis-stat"><span>🟥 Czerwone</span><b>${val(h.red_cards)} : ${val(a.red_cards)}</b></div><div class="analysis-stat"><span>⚑ Faule</span><b>${val(h.fouls)} : ${val(a.fouls)}</b></div>`;
    state.fixtureStats.set(String(id),d);
  }catch(e){target.innerHTML='<span class="analysis-upcoming">Nie udało się pobrać statystyk meczu.</span>';}
}
async function loadCalendarMonth(){
  const y=state.month.getFullYear(),m=state.month.getMonth();
  $("#month-label").textContent=state.month.toLocaleDateString("pl-PL",{month:"long",year:"numeric"});
  const first=new Date(y,m,1),start=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),today=fmtDate(new Date());
  let html=["Pn","Wt","Śr","Cz","Pt","So","Nd"].map(x=>`<span class="weekday">${x}</span>`).join("");
  for(let i=0;i<start;i++)html+='<span class="calendar-day muted"></span>';
  for(let d=1;d<=days;d++){const key=fmtDate(new Date(y,m,d));html+=`<button class="calendar-day ${key===fmtDate(state.selectedDate)?"selected":""} ${key===today?"today":""}" data-date="${key}">${d}</button>`;}
  $("#calendar-grid").innerHTML=html;
  $("#calendar-grid").querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",()=>selectDate(new Date(b.dataset.date+"T12:00:00"))));
}
function renderCalendar(){loadCalendarMonth();}
async function selectDate(d){state.selectedDate=d;$("#fixture-date").value=fmtDate(d);try{await Promise.all([loadFixtures(d),loadCalendarMonth()]);}catch(e){toast(e.message);}}
async function loadLive(){
  const arr=await fixturesForDate(fmtDate(new Date()));
  const live=arr.filter(isLive),chosen=live.length?live:arr.filter(f=>!isDone(f)&&!["CANCELLED","POSTPONED"].includes(statusCode(f))).slice(0,4);
  $("#live-matches").innerHTML=chosen.length?chosen.map(f=>{
    const t=fixtureTeams(f);return `<div class="score-card"><span>${esc(isLive(f)?"NA ŻYWO":String(fixtureDateTime(f)).slice(11,16)||"DZISIAJ")}</span><b>${esc(t.homeName)} <strong>${esc(score(f,"home"))}:${esc(score(f,"away"))}</strong> ${esc(t.awayName)}</b><small>PKO BP Ekstraklasa</small></div>`;
  }).join(""):'<div class="no-live">Brak meczów na żywo. Sprawdź dzisiejszy terminarz.</div>';
}
async function mapLimit(items,limit,fn){
  let index=0;const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(index<items.length){const i=index++;try{await fn(items[i],i);}catch(e){}}});
  await Promise.all(workers);
}
async function loadSeasonDiscipline(){
  const start=seasonStartDate(),end=new Date();state.seasonStart=fmtDate(start);state.seasonEnd=fmtDate(end);
  $("#discipline-period").textContent=`PEŁNY SEZON • ${start.getFullYear()}/${String(start.getFullYear()+1).slice(-2)} • ${state.seasonStart} – ${state.seasonEnd}`;
  const cacheKey=`ei-discipline-v3-${state.leagueId}-${state.seasonStart}-${state.seasonEnd}`;
  try{
    const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
    if(cached&&Date.now()-cached.savedAt<30*60*1000&&Array.isArray(cached.data)){
      state.discipline=cached.data;state.seasonMatches=cached.matchCount||[];
      state.seasonCardMatchTotals=cached.cardMatchTotals||[];
      state.seasonStatsLoaded=true;renderDiscipline();renderFixtures();
      return;
    }
  }catch(e){}
  const dates=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))dates.push(fmtDate(d));
  let done=0;const byDate=[];
  await mapLimit(dates,6,async date=>{
    const fs=await fixturesForDate(date);
    byDate.push(...fs.filter(isDone));
    done++;
    if(done%15===0)$("#discipline-period").textContent=`Pobieranie terminarza: ${done}/${dates.length} dni…`;
  });
  const seen=new Set();
  state.seasonMatches=byDate.filter(f=>{const id=fixtureId(f);if(!id||seen.has(String(id)))return false;seen.add(String(id));return true;})
    .sort((a,b)=>String(fixtureDateTime(a)).localeCompare(String(fixtureDateTime(b))));
  if(!state.seasonMatches.length){state.discipline=[];state.seasonCardMatchTotals=[];renderDiscipline();renderFixtures();return;}
  const agg=new Map(), cardMatchTotals=[];
  const ensure=(id,name,logo)=>{const key=String(id??name);if(!agg.has(key))agg.set(key,{id:key,name,logo,y:0,r:0,f:0,m:0,cardMatches:0,foulMatches:0});return agg.get(key);};
  let statDone=0,cardMatchesAvailable=0;
  await mapLimit(state.seasonMatches,5,async fixture=>{
    const id=fixtureId(fixture);if(!id)return;
    const t=fixtureTeams(fixture);
    try{
      const d=await getFixtureDiscipline(fixture),h=d.home,a=d.away;
      const home=ensure(t.homeId??`${id}-h`,t.homeName,t.homeLogo||state.crestById.get(String(t.homeId||"")));
      const away=ensure(t.awayId??`${id}-a`,t.awayName,t.awayLogo||state.crestById.get(String(t.awayId||"")));
      if(d.hasCards){
        home.y+=h.yellow_cards;away.y+=a.yellow_cards;
        home.r+=h.red_cards;away.r+=a.red_cards;
        home.m++;away.m++;home.cardMatches++;away.cardMatches++;
        cardMatchTotals.push(h.yellow_cards+a.yellow_cards);
        cardMatchesAvailable++;
      }
      if(d.hasFouls){
        if(h.fouls!=null){home.f+=h.fouls;home.foulMatches++;}
        if(a.fouls!=null){away.f+=a.fouls;away.foulMatches++;}
      }
    }catch(e){}
    statDone++;
    if(statDone%10===0)$("#discipline-period").textContent=`Statystyki sezonu: ${statDone}/${state.seasonMatches.length} spotkań…`;
  });
  state.seasonCardMatchTotals=cardMatchTotals;
  state.discipline=[...agg.values()].filter(x=>x.cardMatches>0||x.foulMatches>0).map(x=>({
    ...x,m:x.cardMatches,yAvg:x.cardMatches?x.y/x.cardMatches:0,
    rAvg:x.cardMatches?x.r/x.cardMatches:0,fAvg:x.foulMatches?x.f/x.foulMatches:0
  })).sort((a,b)=>b.y-a.y||b.r-a.r);
  state.seasonStatsLoaded=true;renderDiscipline();renderFixtures();
  try{localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),matchCount:state.seasonMatches.length,data:state.discipline,cardMatchTotals}));}catch(e){}
}
function renderDiscipline(){
  const data=state.discipline,body=$("#discipline-body");
  if(!data.length){body.innerHTML='<tr><td colspan="7" class="empty">Brak statystyk dyscyplinarnych dla bieżącego sezonu. Sprawdź dostępność statystyk meczowych w SportAPI.ai.</td></tr>';return;}
  body.innerHTML=data.map((x,i)=>`<tr><td class="rank">${i+1}</td><td><div class="team-cell">${crest(x.name,x.logo)}<b>${esc(x.name)}</b></div></td><td class="yellow-num">${x.y}</td><td class="red-num">${x.r}</td><td>${x.f}</td><td>${x.m}</td><td>${x.yAvg.toFixed(2)}</td></tr>`).join("");
  const topCards=[...data].sort((a,b)=>b.y-a.y).slice(0,10),topFouls=[...data].sort((a,b)=>b.f-a.f).slice(0,10);
  drawChart("cards-chart",topCards.map(x=>x.name),topCards.map(x=>x.y),"Żółte kartki w sezonie","#e8bd4d");
  drawChart("fouls-chart",topFouls.map(x=>x.name),topFouls.map(x=>x.f),"Faule w sezonie","#6aa7ff");
  $("#cards-chart-note").textContent="TOP 10 • łączna liczba żółtych kartek od początku bieżącego sezonu.";
  $("#fouls-chart-note").textContent="TOP 10 • łączna liczba fauli od początku bieżącego sezonu.";
  $("#discipline-period").textContent=`PEŁNY SEZON • ${state.seasonMatches.length} ZAKOŃCZONYCH MECZÓW • ${state.seasonStart} – ${state.seasonEnd}`;
}
function drawChart(id,labels,values,label,color){
  const canvas=$("#"+id);if(!canvas||!window.Chart)return;if(state.charts[id])state.charts[id].destroy();
  state.charts[id]=new Chart(canvas,{type:"bar",data:{labels,datasets:[{label,data:values,backgroundColor:color,borderRadius:7,borderSkipped:false,maxBarThickness:30}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false},tooltip:{backgroundColor:"#111827",padding:14,titleFont:{size:14},bodyFont:{size:13}}},scales:{x:{grid:{color:"rgba(255,255,255,.08)"},ticks:{color:"#b9c5d8",font:{size:12}}},y:{grid:{display:false},ticks:{color:"#e0e8f5",font:{size:12}}}}}});
}
function poissonProbAtLeast(lambda,k){
  let p0=Math.exp(-lambda),sum=p0,term=p0;
  for(let i=1;i<k;i++){term*=lambda/i;sum+=term;}
  return Math.max(0,Math.min(1,1-sum));
}
function poissonProbExactly(lambda,k){
  let p=Math.exp(-lambda);
  for(let i=1;i<=k;i++)p*=lambda/i;
  return p;
}
function analyze(){
  const h=$("#home-team").value,a=$("#away-team").value,out=$("#analyzer-result");
  if(!h||!a||h===a){out.innerHTML='<div class="result-placeholder">Wybierz dwie różne drużyny, aby oszacować liczbę kartek.</div>';return;}
  const home=state.discipline.find(x=>String(x.id)===h),away=state.discipline.find(x=>String(x.id)===a);
  if(!home||!away||!home.m||!away.m){out.innerHTML='<div class="result-placeholder">Brakuje historycznych danych o kartkach dla jednej z drużyn.</div>';return;}
  const lambda=Math.max(0.1,home.yAvg+away.yAvg);
  const low=poissonProbAtLeast(lambda,4); // 4+ cards
  const lowThree=Math.max(0,1-low-poissonProbExactly(lambda,4));
  const exactlyFour=poissonProbExactly(lambda,4);
  const high=poissonProbAtLeast(lambda,5);
  const pct=n=>`${(n*100).toFixed(1).replace(".",",")}%`;
  const level=high>=.55?"Wysokie ryzyko dużej liczby kartek":high>=.35?"Umiarkowane ryzyko dużej liczby kartek":"Niskie ryzyko dużej liczby kartek";
  const historyCount=Math.min(home.m,away.m);
  out.innerHTML=`<div class="comparison"><div>${crest(home.name,home.logo)}<small>GOSPODARZE</small><b>${esc(home.name)}</b><span>${home.yAvg.toFixed(2).replace(".",",")} <i>żółtych / mecz</i></span><small>${home.m} meczów z danymi</small></div><div class="comparison-vs">VS</div><div>${crest(away.name,away.logo)}<small>GOŚCIE</small><b>${esc(away.name)}</b><span>${away.yAvg.toFixed(2).replace(".",",")} <i>żółtych / mecz</i></span><small>${away.m} meczów z danymi</small></div></div>
  <div class="risk-meter"><div><small>PROGNOZA NA PODSTAWIE SEZONU</small><b>${level}</b></div><div class="meter-track"><i style="width:${Math.min(100,high*100)}%"></i></div></div>
  <div class="probability-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0;">
    <div class="probability-card" style="padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.035);display:flex;flex-direction:column;gap:8px;"><small>MAŁO KARTEK (0–3)</small><strong style="font-size:28px;color:#28d9bd;">${pct(lowThree)}</strong></div>
    <div class="probability-card" style="padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.035);display:flex;flex-direction:column;gap:8px;"><small>ŚREDNIO (4)</small><strong style="font-size:28px;color:#e8bd4d;">${pct(exactlyFour)}</strong></div>
    <div class="probability-card" style="padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.035);display:flex;flex-direction:column;gap:8px;"><small>DUŻO KARTEK (5+)</small><strong style="font-size:28px;color:#ff7185;">${pct(high)}</strong></div>
  </div>
  <p class="disclaimer">Szacunek modelowy Poissona. Oparty na średniej liczbie żółtych kartek obu drużyn w bieżącym sezonie (${home.m} i ${away.m} meczów z danymi). Nie jest gwarancją wyniku ani poradą bukmacherską.</p>`;
}
async function refreshAll(){
  if(state.busy)return;state.busy=true;
  try{
    $("#live-matches").innerHTML='<div class="loading-line">Łączenie z API…</div>';
    if(!state.leagueId)await findLeague();
    await Promise.all([loadStandings(),loadLive(),loadFixtures(state.selectedDate)]);
    $("#discipline-period").textContent="Pobieranie wszystkich zakończonych spotkań bieżącego sezonu…";
    await loadSeasonDiscipline();
    toast("Pobrano dane sezonowe i odświeżono dashboard.");
  }catch(e){showError(e.message);$("#live-matches").innerHTML=`<div class="no-live">${esc(e.message)}</div>`;}
  finally{state.busy=false;}
}
function init(){
  $("#fixture-date").value=fmtDate(state.selectedDate);
  $("#fixture-date").addEventListener("change",e=>selectDate(new Date(e.target.value+"T12:00:00")));
  $("#date-prev").onclick=()=>{const d=new Date(state.selectedDate);d.setDate(d.getDate()-1);selectDate(d);};
  $("#date-next").onclick=()=>{const d=new Date(state.selectedDate);d.setDate(d.getDate()+1);selectDate(d);};
  $("#month-prev").onclick=()=>{state.month.setMonth(state.month.getMonth()-1);loadCalendarMonth();};
  $("#month-next").onclick=()=>{state.month.setMonth(state.month.getMonth()+1);loadCalendarMonth();};
  $("#home-team").onchange=analyze;$("#away-team").onchange=analyze;
  $("#settings-open").onclick=()=>$("#settings-modal").classList.add("open");
  $("#settings-close").onclick=()=>$("#settings-modal").classList.remove("open");
  $("#settings-modal").onclick=e=>{if(e.target.id==="settings-modal")e.currentTarget.classList.remove("open");};
  $("#save-key").onclick=()=>{state.leagueId=null;state.seasonStatsLoaded=false;state.busy=false;$("#settings-modal").classList.remove("open");refreshAll();};
  $("#mobile-menu").onclick=()=>$("#mobile-nav").classList.toggle("open");
  $("#mobile-nav").querySelectorAll("a").forEach(a=>a.onclick=()=>$("#mobile-nav").classList.remove("open"));
  document.querySelectorAll(".nav-link").forEach(a=>a.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(n=>n.classList.remove("active"));a.classList.add("active");}));
  loadCalendarMonth();refreshAll();
}
document.addEventListener("DOMContentLoaded",init);
})();