(() => {
"use strict";
const $ = s => document.querySelector(s);
const state = {key:sessionStorage.getItem("ei_api_key")||"", leagueId:null, teams:[], standings:[], fixtures:[], discipline:[], month:new Date(), selectedDate:new Date(), charts:{}, busy:false};
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => Number.isFinite(Number(v))?Number(v):0;
const toast = msg => {const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),3200)};
const api = async path => {
  if(!state.key) throw new Error("Dodaj klucz API w ustawieniach.");
  const r=await fetch(`${APP_CONFIG.API_BASE}${path}`,{headers:{"X-Api-Key":state.key}});
  let j; try{j=await r.json()}catch{throw new Error("API zwróciło nieprawidłową odpowiedź.");}
  if(!r.ok || j.success===false) throw new Error(j.message||j.error||`Błąd API (${r.status}).`);
  return j;
};
const unwrap = j => Array.isArray(j?.data)?j.data:Array.isArray(j?.fixtures)?j.fixtures:[];
function showError(message){toast(message);$("#standings-body").innerHTML=`<tr><td colspan="10" class="empty">${esc(message)}</td></tr>`;$("#fixtures-list").innerHTML=`<div class="empty">${esc(message)}</div>`;}
async function findLeague(){
  const j=await api("/leagues");const countries=unwrap(j);
  let found=null;
  for(const c of countries){const ls=c.leagues||[];found=ls.find(l=>/ekstraklasa/i.test(l.name||"") && /poland/i.test(c.country||""))||found;}
  if(!found) for(const c of countries) found=(c.leagues||[]).find(l=>/ekstraklasa/i.test(l.name||""))||found;
  if(!found) throw new Error("Nie znaleziono Ekstraklasy na liście lig SportAPI.ai. Sprawdź zakładkę Coverage.");
  state.leagueId=found.id; return found;
}
async function loadStandings(){
 const j=await api(`/standings/${state.leagueId}`);let rows=unwrap(j);
 if(rows.length && rows[0].table) rows=rows.flatMap(g=>g.table||[]);
 state.standings=rows;
 state.teams=rows.map(r=>r.team).filter(Boolean);
 renderStandings();populateTeamSelects();
 $("#standings-updated").textContent=`Aktualizacja: ${new Date().toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"})}`;
}
function renderStandings(){
 const body=$("#standings-body");if(!state.standings.length){body.innerHTML='<tr><td colspan="10" class="empty">Brak danych tabeli w odpowiedzi API.</td></tr>';return;}
 body.innerHTML=state.standings.map((r,i)=>{const t=r.team||{};const form=(r.form||"").split("").slice(-5).map(x=>`<i class="form-${x.toLowerCase()}">${x}</i>`).join("");const gd=num(r.goals_for)-num(r.goals_against);
 return `<tr><td class="rank">${r.position||i+1}</td><td><div class="team-cell"><span class="team-crest">${esc((t.short_name||t.name||"?").slice(0,2).toUpperCase())}</span><b>${esc(t.name||"—")}</b></div></td><td>${num(r.played)}</td><td>${num(r.won)}</td><td>${num(r.draw)}</td><td>${num(r.lost)}</td><td>${num(r.goals_for)}:${num(r.goals_against)}</td><td class="${gd>0?"positive":gd<0?"negative":""}">${gd>0?"+":""}${gd}</td><td class="points">${num(r.points)}</td><td><div class="form-list">${form||"—"}</div></td></tr>`}).join("");
}
function populateTeamSelects(){
 const opts=state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("");
 $("#home-team").innerHTML='<option value="">Wybierz drużynę</option>'+opts;$("#away-team").innerHTML='<option value="">Wybierz drużynę</option>'+opts;
}
async function loadFixtures(date){
 const j=await api(`/fixtures/date/${fmtDate(date)}`);const all=unwrap(j);
 state.fixtures=all.filter(f=>!state.leagueId||Number(f.league_id)===Number(state.leagueId));
 renderFixtures();renderCalendar();
}
function renderFixtures(){
 $("#fixtures-title").textContent=new Date(fmtDate(state.selectedDate)+"T12:00:00").toLocaleDateString("pl-PL",{day:"numeric",month:"long",year:"numeric"});
 $("#fixtures-subtitle").textContent="SPOTKANIA W WYBRANYM DNIU";$("#fixture-count").textContent=`${state.fixtures.length} SPOTKAŃ`;
 const el=$("#fixtures-list");
 if(!state.fixtures.length){el.innerHTML='<div class="empty empty-large">Brak spotkań Ekstraklasy w tym dniu.<br><small>Wybierz inną datę w kalendarzu.</small></div>';return;}
 el.innerHTML=state.fixtures.map(f=>{const live=["LIVE","HT"].includes(f.status);const done=["FT","AET","PENS"].includes(f.status);const status=live?`<span class="match-live">${esc(f.minute||"LIVE")}</span>`:done?'<span class="match-done">KONIEC</span>':`<span class="match-time">${esc((f.datetime||"").slice(11,16)||"—")}</span>`;
 return `<article class="fixture-row"><div class="fixture-status">${status}</div><div class="fixture-team home"><b>${esc(f.home_team||"Gospodarze")}</b><span class="team-crest small">${esc((f.home_short||f.home_team||"??").slice(0,2).toUpperCase())}</span></div><div class="fixture-score">${done||live?`${num(f.home_score)} <i>:</i> ${num(f.away_score)}`:"— : —"}</div><div class="fixture-team away"><span class="team-crest small">${esc((f.away_short||f.away_team||"??").slice(0,2).toUpperCase())}</span><b>${esc(f.away_team||"Goście")}</b></div></article>`}).join("");
}
async function loadCalendarMonth(){
 const y=state.month.getFullYear(),m=state.month.getMonth();$("#month-label").textContent=state.month.toLocaleDateString("pl-PL",{month:"long",year:"numeric"});
 const first=new Date(y,m,1),start=(first.getDay()+6)%7;const days=new Date(y,m+1,0).getDate();const today=fmtDate(new Date());
 let html=["Pn","Wt","Śr","Cz","Pt","So","Nd"].map(x=>`<span class="weekday">${x}</span>`).join("");
 for(let i=0;i<start;i++)html+='<span class="calendar-day muted"></span>';
 for(let d=1;d<=days;d++){const dt=new Date(y,m,d),key=fmtDate(dt);html+=`<button class="calendar-day ${key===fmtDate(state.selectedDate)?"selected":""} ${key===today?"today":""}" data-date="${key}">${d}</button>`}
 $("#calendar-grid").innerHTML=html;
 $("#calendar-grid").querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",()=>selectDate(new Date(b.dataset.date+"T12:00:00"))));
}
function renderCalendar(){loadCalendarMonth()}
async function selectDate(d){state.selectedDate=d;$("#fixture-date").value=fmtDate(d);await Promise.all([loadFixtures(d),loadCalendarMonth()]).catch(e=>toast(e.message));}
async function loadLive(){
 const today=fmtDate(new Date());const j=await api(`/fixtures/date/${today}`);const arr=unwrap(j).filter(f=>!state.leagueId||Number(f.league_id)===Number(state.leagueId));
 const live=arr.filter(f=>["LIVE","HT"].includes(f.status));const chosen=live.length?live:arr.filter(f=>!["FT","AET","PENS","Cancelled","Postponed"].includes(f.status)).slice(0,3);
 $("#live-matches").innerHTML=chosen.length?chosen.map(f=>`<div class="score-card"><span>${esc(f.status==="LIVE"?"NA ŻYWO":(f.datetime||"").slice(11,16)||"DZISIAJ")}</span><b>${esc(f.home_short||f.home_team)} <strong>${f.home_score??"—"} : ${f.away_score??"—"}</strong> ${esc(f.away_short||f.away_team)}</b><small>${esc(f.league_name||"PKO BP Ekstraklasa")}</small></div>`).join(""):'<div class="no-live">Brak meczów na żywo. Sprawdź dzisiejszy terminarz.</div>';
}
async function loadDiscipline(){
 const past=state.fixtures.filter(f=>["FT","AET","PENS"].includes(f.status));
 // Fixture date endpoint returns only one date. Query a short recent window to build a limited, transparent sample.
 const dates=[];for(let i=1;i<=18;i++){const d=new Date();d.setDate(d.getDate()-i);dates.push(fmtDate(d))}
 const results=await Promise.all(dates.map(async d=>{try{return unwrap(await api(`/fixtures/date/${d}`)).filter(f=>Number(f.league_id)===Number(state.leagueId)&&["FT","AET","PENS"].includes(f.status))}catch{return []}}));
 const matches=results.flat().sort((a,b)=>(b.datetime||"").localeCompare(a.datetime||"")).slice(0,APP_CONFIG.MAX_MATCH_STATS_PER_REFRESH);
 if(!matches.length){$("#discipline-body").innerHTML='<tr><td colspan="6" class="empty">Brak zakończonych spotkań w pobranym zakresie.</td></tr>';return;}
 const stats=await Promise.all(matches.map(async f=>{try{return {f,s:await api(`/fixtures/${f.id}/stats`)}}catch{return null}}));
 const agg={};const add=(id,name,v)=>{if(!agg[id])agg[id]={id,name,y:0,r:0,f:0,m:0};agg[id].y+=num(v.yellow_cards);agg[id].r+=num(v.red_cards);agg[id].f+=num(v.fouls);agg[id].m++};
 stats.filter(Boolean).forEach(({f,s})=>{const d=s.data||{};if(d.home)add(f.home_id,f.home_team,d.home);if(d.away)add(f.away_id,f.away_team,d.away)});
 state.discipline=Object.values(agg).filter(x=>x.m).sort((a,b)=>b.y-a.y||b.r-a.r);
 renderDiscipline();
}
function renderDiscipline(){
 const data=state.discipline;const body=$("#discipline-body");
 if(!data.length){body.innerHTML='<tr><td colspan="6" class="empty">Dostawca nie zwrócił statystyk kartek i fauli dla pobranych spotkań.</td></tr>';return;}
 body.innerHTML=data.map((x,i)=>`<tr><td class="rank">${i+1}</td><td><div class="team-cell"><span class="team-crest">${esc(x.name.slice(0,2).toUpperCase())}</span><b>${esc(x.name)}</b></div></td><td class="yellow-num">${x.y}</td><td class="red-num">${x.r}</td><td>${x.f}</td><td>${x.m}</td></tr>`).join("");
 drawChart("cards-chart",data.slice(0,8).map(x=>x.name),data.slice(0,8).map(x=>x.y),"Żółte kartki","#e8bd4d");
 drawChart("fouls-chart",data.slice(0,8).map(x=>x.name),data.slice(0,8).map(x=>Math.round(x.f/x.m*10)/10),"Faule / mecz","#6aa7ff");
 $("#cards-chart-note").textContent=`Próba: maks. ${matchesLabel(data)} wystąpień drużyn z ostatnich pobranych meczów.`;
 $("#fouls-chart-note").textContent="Średnia liczba fauli na mecz w dostępnej próbie.";
}
function matchesLabel(d){return Math.max(...d.map(x=>x.m),0)}
function drawChart(id,labels,values,label,color){
 const canvas=$("#"+id);if(!canvas||!window.Chart)return;if(state.charts[id])state.charts[id].destroy();
 state.charts[id]=new Chart(canvas,{type:"bar",data:{labels,datasets:[{label,data:values,backgroundColor:color,borderRadius:7,borderSkipped:false,maxBarThickness:24}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false},tooltip:{backgroundColor:"#111827",padding:12}},scales:{x:{grid:{color:"rgba(255,255,255,.06)"},ticks:{color:"#8390a7"}},y:{grid:{display:false},ticks:{color:"#c6cede"}}}}});
}
function analyze(){
 const h=$("#home-team").value,a=$("#away-team").value;const out=$("#analyzer-result");
 if(!h||!a||h===a){out.innerHTML='<div class="result-placeholder">Wybierz dwie różne drużyny, aby zobaczyć porównanie.</div>';return}
 const home=state.discipline.find(x=>String(x.id)===h),away=state.discipline.find(x=>String(x.id)===a);
 if(!home||!away){out.innerHTML='<div class="result-placeholder">Brakuje danych dyscyplinarnych dla jednej z drużyn. Po pobraniu statystyk spróbuj ponownie.</div>';return}
 const avg=x=>({cards:x.y/x.m,fouls:x.f/x.m});
 const x=avg(home),y=avg(away),risk=(x.cards+y.cards+x.fouls/10+y.fouls/10)/2;
 const level=risk>=5?"Wysoki":risk>=3.3?"Umiarkowany":"Niższy";
 out.innerHTML=`<div class="comparison"><div><small>GOSPODARZE</small><b>${esc(home.name)}</b><span>${x.cards.toFixed(1)} <i>żółtych / mecz</i></span><span>${x.fouls.toFixed(1)} <i>fauli / mecz</i></span></div><div class="comparison-vs">VS</div><div><small>GOŚCIE</small><b>${esc(away.name)}</b><span>${y.cards.toFixed(1)} <i>żółtych / mecz</i></span><span>${y.fouls.toFixed(1)} <i>fauli / mecz</i></span></div></div><div class="risk-meter"><div><small>PROFIL DYSYPLINARNY PRÓBY</small><b>${level}</b></div><div class="meter-track"><i style="width:${Math.min(100,risk/7*100)}%"></i></div></div>`;
}
async function refreshAll(){
 if(state.busy)return;state.busy=true;
 try{
  if(!state.key){$("#live-matches").innerHTML='<div class="no-live">Dodaj klucz SportAPI.ai w ustawieniach, aby uruchomić dane na żywo.</div>';showError("Dodaj klucz API w ustawieniach, aby pobrać tabelę.");return}
  $("#live-matches").innerHTML='<div class="loading-line">Łączenie z SportAPI.ai…</div>';
  if(!state.leagueId)await findLeague();
  await Promise.all([loadStandings(),loadLive(),loadFixtures(state.selectedDate)]);
  await loadDiscipline();
  toast("Dane zostały odświeżone.");
 }catch(e){showError(e.message);$("#live-matches").innerHTML=`<div class="no-live">${esc(e.message)}</div>`}
 finally{state.busy=false}
}
function init(){
 $("#fixture-date").value=fmtDate(state.selectedDate);
 $("#fixture-date").addEventListener("change",e=>selectDate(new Date(e.target.value+"T12:00:00")));
 $("#date-prev").onclick=()=>{const d=new Date(state.selectedDate);d.setDate(d.getDate()-1);selectDate(d)};
 $("#date-next").onclick=()=>{const d=new Date(state.selectedDate);d.setDate(d.getDate()+1);selectDate(d)};
 $("#month-prev").onclick=()=>{state.month.setMonth(state.month.getMonth()-1);loadCalendarMonth()};
 $("#month-next").onclick=()=>{state.month.setMonth(state.month.getMonth()+1);loadCalendarMonth()};
 $("#home-team").onchange=analyze;$("#away-team").onchange=analyze;
 $("#settings-open").onclick=()=>{$("#api-key-input").value=state.key;$("#settings-modal").classList.add("open")};
 $("#settings-close").onclick=()=>$("#settings-modal").classList.remove("open");
 $("#settings-modal").onclick=e=>{if(e.target.id==="settings-modal")e.currentTarget.classList.remove("open")};
 $("#save-key").onclick=()=>{const k=$("#api-key-input").value.trim();if(!k){toast("Wklej klucz API.");return}state.key=k;sessionStorage.setItem("ei_api_key",k);state.leagueId=null;$("#settings-modal").classList.remove("open");refreshAll()};
 $("#clear-key").onclick=()=>{state.key="";sessionStorage.removeItem("ei_api_key");$("#api-key-input").value="";toast("Klucz usunięty z tej sesji.")};
 $("#mobile-menu").onclick=()=>$("#mobile-nav").classList.toggle("open");
 $("#mobile-nav").querySelectorAll("a").forEach(a=>a.onclick=()=>$("#mobile-nav").classList.remove("open"));
 document.querySelectorAll(".nav-link").forEach(a=>a.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(n=>n.classList.remove("active"));a.classList.add("active")}));
 loadCalendarMonth();
 if(state.key)refreshAll();else{$("#live-matches").innerHTML='<div class="no-live">Dodaj klucz API w ⚙ ustawieniach, aby zobaczyć dane Ekstraklasy.</div>';$("#standings-body").innerHTML='<tr><td colspan="10" class="empty">Połącz API, aby załadować aktualną tabelę.</td></tr>'}
}
document.addEventListener("DOMContentLoaded",init);
})();