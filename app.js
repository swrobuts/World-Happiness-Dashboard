// app.js — Präsentationsschicht. Die Daten kommen aus Supabase und werden
// von data.js geladen und als window.__WHI_DATA__ bereitgestellt, bevor
// dieses Skript ausgeführt wird (siehe data.js / index.html).
const DATA = window.__WHI_DATA__;
const C={paper:"#F4F2ED",ink:"#1A1A1A",ink60:"#6B6B6B",ink40:"#9A968E",ink30:"#B8B5AE",line:"#D8D5CD",hair:"#E7E4DC",accent:"#E2571E",accent2:"#2B4C7E",up:"#2E7D4F",down:"#C0381A"};
const PALETTE=[C.accent,C.accent2,"#2E7D4F","#8A6D3B"];
const co=DATA.countries,YEARS=DATA.years,NAMES=Object.keys(co).sort();
const Y0=YEARS[0],Y1=YEARS[YEARS.length-1];
let year=Y1, yearF=Y1;
let selected=["Finland","Germany"].filter(n=>co[n]);
let view="map", mapFilterActive=false;
let scoreWin=[1,8];        // two-handle score window for the map
let distortMode="off";     // off | happy | unhappy

// global score range for comparable sparkline scaling
const ALLV=NAMES.flatMap(n=>co[n].series.map(p=>p[1]));
const GMIN=d3.min(ALLV), GMAX=d3.max(ALLV);

function interpScore(n,yf){const s=co[n].series;if(!s.length)return null;if(yf<=s[0][0])return s[0][1];if(yf>=s[s.length-1][0])return s[s.length-1][1];for(let i=0;i<s.length-1;i++){const[ya,va]=s[i],[yb,vb]=s[i+1];if(yf>=ya&&yf<=yb){const t=(yf-ya)/(yb-ya);return va+(vb-va)*t;}}return s[s.length-1][1];}
function scoreAt(n,y){let v=null;for(const[yy,s]of co[n].series){if(yy===y)return s;if(yy<y)v=s;}return v;}
function smap(n){const m={};for(const[y,s]of co[n].series)m[y]=s;return m;}
function rankingF(yf){return NAMES.map(n=>({name:n,score:interpScore(n,yf)})).filter(d=>d.score!=null).sort((a,b)=>b.score-a.score);}
function ranking(y){return rankingF(y);}
function prevYear(y){const i=YEARS.indexOf(y);return i>0?YEARS[i-1]:null;}
function deltaFirst(n,yf=yearF){const a=co[n].series[0][1],b=interpScore(n,yf);return(a!=null&&b!=null)?b-a:null;}
function deltaPrev(n,y=year){const py=prevYear(y);if(py==null)return null;const a=scoreAt(n,py),b=scoreAt(n,y);return(a!=null&&b!=null)?b-a:null;}
function sgn(v,d=2){return v==null?"":(v>=0?"+":"")+v.toFixed(d);}

// color ramp — widened & perceptually stepped
const RAMP=["#5B1A8B","#9E1F1A","#D63B1A","#EE7B26","#F4B14A","#EBD96B","#A9CF66","#5BA84F","#2E7D32"]; // low→high, high contrast
const RAMP_DOM=[2.2,3.2,4.0,4.7,5.3,5.9,6.5,7.1,7.8];
const colScale=d3.scaleLinear().domain(RAMP_DOM).range(RAMP).clamp(true).interpolate(d3.interpolateRgb);
function colorFor(s){return s==null?"#E6E3DC":colScale(s);}

// ============ KPI TILES (globally comparable sparklines) ============
function medianSeries(){return YEARS.map(y=>{const v=NAMES.map(n=>scoreAt(n,y)).filter(s=>s!=null);return d3.median(v);});}
function kpiSpark(values,fixedDomain,years){
  const w=240,h=40; // wider viewBox ≈ rendered width → no letterboxing, line fills full width
  const x=d3.scaleLinear().domain([Y0,Y1]).range([4,w-4]);
  const y=d3.scaleLinear().domain(fixedDomain).range([h-7,7]);
  const pts=values.map((v,i)=>[years?years[i]:Y0+i, v]);
  const line=d3.line().x(d=>x(d[0])).y(d=>y(d[1])).curve(d3.curveMonotoneX);
  const last=pts.length-1;
  let dots="";
  pts.forEach((p,i)=>{
    const isLast=i===last;
    dots+=`<circle class="kpidot" cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="${isLast?4:2.6}" `+
      `fill="${isLast?C.down:'#9A968E'}" stroke="#fff" stroke-width="1" `+
      `data-y="${p[0]}" data-v="${p[1].toFixed(2)}"/>`;
  });
  return `<svg class="spk" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`+
    `<path d="${line(pts)}" fill="none" stroke="${C.ink60}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`+
    dots+`</svg>`;
}
function badgeIcon(kind){
  const s='width="14" height="14" viewBox="0 0 24 24" fill="currentColor"';
  if(kind==="star")return `<svg ${s}><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>`;
  if(kind==="up")return `<svg ${s}><path d="M12 4l8 10h-5v6H9v-6H4z"/></svg>`;
  if(kind==="down")return `<svg ${s}><path d="M12 20L4 10h5V4h6v6h5z"/></svg>`;
  // median: approx-equals bars
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 9c3-3 5-3 8 0s5 3 8 0M4 16c3-3 5-3 8 0s5 3 8 0"/></svg>`;
}
function buildKPIs(){
  const r=ranking(year), top=r[0], med=d3.median(r,d=>d.score), py=prevYear(year);
  let riser=null,faller=null;
  for(const n of NAMES){const dp=deltaPrev(n,year);if(dp==null)continue;if(!riser||dp>riser.d)riser={n,d:dp};if(!faller||dp<faller.d)faller={n,d:dp};}
  const medPrev=py!=null?d3.median(NAMES.map(n=>scoreAt(n,py)).filter(s=>s!=null)):null;
  const FD=[GMIN-0.1,GMAX+0.1]; // identical domain for all sparklines → comparable
  const fullSpark=(name)=>YEARS.map(y=>interpScore(name,y)); // no gaps → spans full 2011–2025
  const tiles=[
    {cls:"lead",cap:`Spitzenreiter ${year}`,badge:"star",bg:"bg-lead",name:top.name,score:top.score,delta:deltaPrev(top.name,year),spark:fullSpark(top.name),sy:YEARS},
    {cls:"",cap:"Globaler Median",badge:"median",bg:"bg-neutral",name:"alle 164 Länder",score:med,delta:medPrev!=null?med-medPrev:null,spark:medianSeries(),sy:YEARS},
    {cls:"",cap:`Stärkster Aufstieg ${py??""}→${year}`,badge:"up",bg:"bg-up",name:riser?riser.n:"–",score:riser?scoreAt(riser.n,year):null,delta:riser?riser.d:null,spark:riser?fullSpark(riser.n):[],sy:YEARS},
    {cls:"",cap:`Stärkster Abstieg ${py??""}→${year}`,badge:"down",bg:"bg-down",name:faller?faller.n:"–",score:faller?scoreAt(faller.n,year):null,delta:faller?faller.d:null,spark:faller?fullSpark(faller.n):[],sy:YEARS},
  ];
  document.getElementById("kpis").innerHTML=tiles.map(t=>{
    const dCls=t.delta==null?"":(t.delta>=0?"up":"down");
    const arrow=t.delta==null?"":(t.delta>=0?"▲":"▼");
    // filter nulls but keep year alignment
    const pairs=t.spark.map((v,i)=>[v,t.sy[i]]).filter(p=>p[0]!=null);
    const vals=pairs.map(p=>p[0]), yrs=pairs.map(p=>p[1]);
    return `<div class="tile ${t.cls}">
      <div class="cap">${t.cap}</div>
      <div class="who"><span class="badge ${t.bg}">${badgeIcon(t.badge)}</span><span class="big">${t.name}</span></div>
      <div class="row2"><span class="scoreval">${t.score!=null?t.score.toFixed(2):"–"}</span>
        <span class="delta ${dCls}">${t.delta==null?"":arrow+" "+Math.abs(t.delta).toFixed(2)}</span></div>
      ${vals.length>1?kpiSpark(vals,FD,yrs):""}
      <div class="spkcap"><span>'11</span><span>einheitliche Skala ${FD[0].toFixed(1)}–${FD[1].toFixed(1)}</span><span>'25</span></div>
      <div class="yearwm tilewm"><span></span></div>
    </div>`;
  }).join("");
  // hover tooltips on KPI dots
  document.querySelectorAll("#kpis .kpidot").forEach(dot=>{
    dot.addEventListener("mousemove",e=>{
      const tip=document.getElementById("kpitip");
      tip.style.display="block";
      tip.style.left=(e.clientX+12)+"px";tip.style.top=(e.clientY+12)+"px";
      tip.innerHTML=`<strong>${dot.dataset.y}</strong> · ${dot.dataset.v}`;
    });
    dot.addEventListener("mouseleave",()=>{document.getElementById("kpitip").style.display="none";});
  });
}

// ============ messages ============
function topCountry(y){return ranking(y)[0];}
function leadSince(){let n=topCountry(year).name,since=year;for(let i=YEARS.indexOf(year);i>=0;i--){if(topCountry(YEARS[i]).name===n)since=YEARS[i];else break;}return since;}
function updateMessages(){
  const r=ranking(year),top=r[0],spread=r[0].score-r[r.length-1].score,med=d3.median(r,d=>d.score);
  document.getElementById("curYear").textContent=Math.round(yearF);
  const since=leadSince();
  document.getElementById("tblMsg").innerHTML=`<span class="hl">${top.name}</span> oben`+(since<year?` (seit ${since})`:``)+`, <span class="hl">${spread.toFixed(1)} Punkte</span> Spanne bis zum niedrigsten Wert`;
  document.getElementById("topYear").textContent=year;document.getElementById("flopYear").textContent=year;
  if(view==="map"){
    document.getElementById("viewMsg").innerHTML=`Der Norden bleibt vorn – Wohlstandsgürtel quer über den Globus`;
  }else if(view==="bar"){
    document.getElementById("viewMsg").innerHTML=`Die Spitze liegt dicht, das Ende fällt weit ab`;
  }else{
    document.getElementById("viewMsg").innerHTML=`Das Gros liegt um <span class="hl">${med.toFixed(1)}</span> – wenige Ausreißer`;
  }
  if(selected.length){
    document.getElementById("cmpMsg").innerHTML=`Langfristtrend seit ${Y0}`;
    document.getElementById("cmpMeta").textContent=selected.map(n=>{const d=deltaFirst(n,year);return `${n} ${d>=0?"▲":"▼"}${Math.abs(d).toFixed(2)}`;}).join("   ·   ");
  }else{document.getElementById("cmpMsg").innerHTML=`Vergleich im Zeitverlauf`;document.getElementById("cmpMeta").textContent="Kein Land gewählt";}
}

// ============ year scrubber + smooth animation ============
function trackX(){const el=document.getElementById("track");const W=el.clientWidth||600;return d3.scaleLinear().domain([Y0,Y1]).range([14,W-14]);}
function drawTrack(){
  const svg=d3.select("#trackSvg");svg.selectAll("*").remove();
  const el=document.getElementById("track");const W=el.clientWidth||600,H=60;
  const x=d3.scaleLinear().domain([Y0,Y1]).range([16,W-16]);svg.attr("viewBox",`0 0 ${W} ${H}`);
  const TY=30; // track vertical center (room above for the running year label)
  const trackCol=C.line;
  svg.append("line").attr("x1",16).attr("x2",W-16).attr("y1",TY).attr("y2",TY).attr("stroke",trackCol).attr("stroke-width",2.5);
  svg.append("line").attr("id","progress").attr("x1",16).attr("x2",x(yearF)).attr("y1",TY).attr("y2",TY).attr("stroke",C.accent).attr("stroke-width",3);
  svg.selectAll("circle.tick").data(YEARS).join("circle").attr("class","tick").attr("cx",d=>x(d)).attr("cy",TY)
    .attr("r",d=>d===Math.round(yearF)?5.5:3.5)
    .attr("fill",d=>d<=year?C.accent:"#fff").attr("stroke",d=>d<=year?C.accent:C.ink30).attr("stroke-width",1.2).style("cursor","pointer").on("click",(e,d)=>jumpYear(d));
  svg.selectAll("text.yl").data(YEARS).join("text").attr("class","yl").attr("x",d=>x(d)).attr("y",TY+24).attr("text-anchor","middle").attr("font-size",d=>d===year?14:13)
    .attr("fill",d=>d===year?C.ink:C.ink60).attr("font-weight",d=>d===year?700:500).style("cursor","pointer").text(d=>"'"+String(d).slice(2)).on("click",(e,d)=>jumpYear(d));
  // running indicator: handle with soft halo + floating year above
  const g=svg.append("g").attr("id","indicator");
  g.append("circle").attr("id","handleHalo").attr("cx",x(yearF)).attr("cy",TY).attr("r",11).attr("fill",C.accent).attr("opacity",0.16);
  g.append("circle").attr("id","handle").attr("cx",x(yearF)).attr("cy",TY).attr("r",7).attr("fill",C.accent).attr("stroke",C.paper).attr("stroke-width",2);
  g.append("text").attr("id","bubbleText").attr("x",x(yearF)).attr("y",12).attr("text-anchor","middle").attr("font-size",13).attr("font-weight",700).attr("fill",C.accent).attr("font-variant-numeric","tabular-nums").text(Math.round(yearF));
}
function updateYearWM(visible){
  const yr=Math.round(yearF);
  ["wmTop","wmFlop","wmMap"].forEach(id=>{const el=document.getElementById(id);if(el){el.querySelector("span").textContent=yr;el.classList.toggle("show",!!visible);}});
  document.querySelectorAll("#kpis .tilewm").forEach(el=>{el.querySelector("span").textContent=yr;el.classList.toggle("show",!!visible);});
}
function setHandle(){
  const x=trackX();const cx=x(yearF);
  d3.select("#handle").attr("cx",cx);
  d3.select("#handleHalo").attr("cx",cx);
  d3.select("#progress").attr("x2",cx);
  d3.select("#bubbleText").attr("x",cx).text(Math.round(yearF));
  // emphasize the tick nearest the current position
  const cur=Math.round(yearF);
  d3.selectAll("#trackSvg circle.tick").attr("r",d=>d===cur?5.5:3.5);
  d3.selectAll("#trackSvg text.yl").attr("font-size",d=>d===cur?14:13).attr("fill",d=>d===cur?C.ink:C.ink60).attr("font-weight",d=>d===cur?700:500);
}
function jumpYear(y){stopPlay();year=y;yearF=y;refreshAll();updateYearWM(false);}
function setYearFrac(yf){yearF=yf;const ny=Math.round(yf);if(ny!==year)year=ny;document.getElementById("curYear").textContent=Math.round(yf);setHandle();buildKPIs();updateMessages();renderTables();renderView();updateYearWM(true);}
let playing=false,raf=null;
function stopPlay(){playing=false;if(raf)cancelAnimationFrame(raf);document.getElementById("playBtn").innerHTML="▶&nbsp;Abspielen";if(typeof updateYearWM==="function")updateYearWM(false);}
document.getElementById("playBtn").onclick=function(){
  if(playing){stopPlay();return;}
  playing=true;this.innerHTML="❚❚&nbsp;Stop";let start=null;const from=Y0,to=Y1,dur=12000;yearF=from;
  function step(ts){if(!playing)return;if(start==null)start=ts;const t=Math.min(1,(ts-start)/dur);setYearFrac(from+(to-from)*t);if(t<1)raf=requestAnimationFrame(step);else{stopPlay();year=to;yearF=to;refreshAll();updateYearWM(false);}}
  raf=requestAnimationFrame(step);
};
document.getElementById("track").addEventListener("click",function(e){if(e.target.classList.contains("tick")||e.target.classList.contains("yl"))return;const r=this.getBoundingClientRect();const x=trackX();jumpYear(Math.max(Y0,Math.min(Y1,Math.round(x.invert(e.clientX-r.left)))));});

// ============ twin tables with comparable sparklines ============
function sparkSVG(name,w=64,h=24,domLo,domHi){
  const pts=co[name].series;
  const x=d3.scaleLinear().domain([Y0,Y1]).range([2,w-2]);
  const lo=domLo!=null?domLo:GMIN-0.2, hi=domHi!=null?domHi:GMAX+0.2;
  const y=d3.scaleLinear().domain([lo,hi]).range([h-3,3]);
  const line=d3.line().x(d=>x(d[0])).y(d=>y(d[1])).curve(d3.curveMonotoneX);
  const cv=interpScore(name,yearF);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`+
    `<path d="${line(pts)}" fill="none" stroke="${C.ink60}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`+
    `<circle cx="${x(yearF).toFixed(1)}" cy="${y(cv).toFixed(1)}" r="2.8" fill="${C.accent}" stroke="#fff" stroke-width="0.8"/></svg>`;
}
function rankColor(side,posInTen){
  // posInTen: 0 = strongest position in this table. Full saturation at 0, eases to a mid-tone
  // (never near-white) so white text keeps contrast across all rows.
  const t=posInTen/9; // 0..1
  if(side==="top"){ // blue: deep → medium blue
    const a=[31,78,140], b=[96,133,179];
    return `rgb(${a.map((c,i)=>Math.round(c+(b[i]-c)*t)).join(",")})`;
  } else { // red: deep → medium red ("je schlechter, desto röter")
    const a=[176,48,26], b=[201,118,99];
    return `rgb(${a.map((c,i)=>Math.round(c+(b[i]-c)*t)).join(",")})`;
  }
}
function rowHTML(d,rank,side,posInTen,domLo,domHi){
  const dlt=deltaFirst(d.name,yearF);
  const rkColor=rankColor(side,posInTen);
  return `<div class="row${selected.includes(d.name)?" sel":""}" data-n="${d.name}">`+
    `<span class="rk" style="background:${rkColor};color:#fff">${rank}</span><span class="nm">${d.name}</span>`+
    `<span>${sparkSVG(d.name,70,24,domLo,domHi)}</span>`+
    `<span class="val">${d.score.toFixed(2)}</span>`+
    `<span class="chg ${dlt>=0?'up':'down'}">${dlt==null?'':(dlt>=0?'+':'')+dlt.toFixed(1)}</span></div>`;
}
// sort state per side: {key, dir}
const sortState={top:{key:"rank",dir:1},flop:{key:"rank",dir:1}};
function sortRows(items,withRank,state){
  const arr=items.map(d=>({...d,_rank:d._rank,_delta:deltaFirst(d.name,yearF)}));
  const k=state.key,dir=state.dir;
  arr.sort((a,b)=>{
    let va,vb;
    if(k==="rank"){va=a._rank;vb=b._rank;}
    else if(k==="name"){return dir*a.name.localeCompare(b.name);}
    else if(k==="score"){va=a.score;vb=b.score;}
    else{va=a._delta??-99;vb=b._delta??-99;}
    return dir*(va-vb);
  });
  return arr;
}
const tblQuery={top:"",flop:""};
function renderTables(){
  const full=rankingF(yearF);
  full.forEach((d,i)=>d._rank=i+1);
  const lastRank=full.length;
  // sparkline domain: keep stable per side using the default-10 ranges so spark heights stay comparable
  const top10=full.slice(0,10), flop10=full.slice(-10);
  const tHist=top10.flatMap(d=>co[d.name].series.map(p=>p[1]));
  const fHist=flop10.flatMap(d=>co[d.name].series.map(p=>p[1]));
  const tLo=d3.min(tHist)-0.15,tHi=d3.max(tHist)+0.15, fLo=d3.min(fHist)-0.15,fHi=d3.max(fHist)+0.15;

  function build(side,defaultRows,domLo,domHi){
    const q=tblQuery[side].trim().toLowerCase();
    const listEl=document.getElementById(side==="top"?"topList":"flopList");
    const wrapEl=document.getElementById(side==="top"?"wrapTop":"wrapFlop");
    let rows, filtered=false;
    if(q){
      rows=full.filter(d=>d.name.toLowerCase().includes(q)); filtered=true;
    }else{
      rows=sortRows(defaultRows,true,sortState[side]);
    }
    // scroll only when the filtered result is long
    wrapEl.classList.toggle("scroll", filtered && rows.length>12);
    if(rows.length===0){listEl.innerHTML=`<div class="noresult">Kein Land gefunden für „${tblQuery[side]}".</div>`;return;}
    listEl.innerHTML=rows.map(d=>{
      const posInTen = side==="top" ? d._rank-1 : lastRank-d._rank;
      return rowHTML(d,d._rank,side,Math.max(0,Math.min(9,posInTen)),domLo,domHi);
    }).join("");
  }
  build("top", full.slice(0,10), tLo,tHi);
  build("flop", full.slice(-10), fLo,fHi);

  document.querySelectorAll(".row").forEach(r=>r.onclick=()=>toggle(r.dataset.n));
  document.querySelectorAll('.rhead').forEach(h=>{
    const side=h.dataset.side;const st=sortState[side];
    h.querySelectorAll('.sortable').forEach(c=>{
      const active=c.dataset.k===st.key;c.classList.toggle('active',active);
      let ar=c.querySelector('.ar');if(!ar){ar=document.createElement('span');ar.className='ar';c.appendChild(ar);}
      ar.textContent=active?(st.dir>0?'▲':'▼'):'';
    });
  });
}
function initSortHeaders(){
  document.querySelectorAll('.rhead .sortable').forEach(c=>{
    c.onclick=()=>{const side=c.closest('.rhead').dataset.side;const st=sortState[side];const k=c.dataset.k;
      if(st.key===k)st.dir*=-1;else{st.key=k;st.dir=(k==="name")?1:(k==="rank")?1:-1;}
      renderTables();};
  });
  const sTop=document.getElementById("searchTop"),sFlop=document.getElementById("searchFlop");
  if(sTop)sTop.addEventListener("input",()=>{tblQuery.top=sTop.value;renderTables();});
  if(sFlop)sFlop.addEventListener("input",()=>{tblQuery.flop=sFlop.value;renderTables();});
}
function toggle(name){if(selected.includes(name))selected=selected.filter(x=>x!==name);else if(selected.length<4)selected=[...selected,name];refreshAll();}

// ============ chips + compare chart ============
function renderChips(){
  const c=document.getElementById("chips");
  if(selected.length===0){c.innerHTML='<span class="empty">Land in Tabelle oder Karte wählen (max. 4).</span>';return;}
  c.innerHTML=selected.map((n,i)=>`<span class="chip"><span class="sw" style="background:${PALETTE[i]}"></span>${n}<button data-n="${n}">×</button></span>`).join("");
  c.querySelectorAll("button").forEach(b=>b.onclick=(e)=>{e.stopPropagation();toggle(b.dataset.n);});
}
function drawChartInto(sel,W,H,big,tipId){
  const svg=d3.select(sel);svg.selectAll("*").remove();svg.attr("viewBox",`0 0 ${W} ${H}`).attr("height",H);
  const m={t:18,r:big?86:64,b:30,l:38};
  const x=d3.scaleLinear().domain([Y0,Y1]).range([m.l,W-m.r]);
  const allv=selected.flatMap(n=>co[n].series.map(p=>p[1]));
  const y=d3.scaleLinear().domain(selected.length?[Math.min(4,d3.min(allv)-0.3),d3.max(allv)+0.3]:[2,8]).range([H-m.b,m.t]);
  svg.append("g").selectAll("line").data(y.ticks(6)).join("line").attr("class","gridline").attr("x1",m.l).attr("x2",W-m.r).attr("y1",d=>y(d)).attr("y2",d=>y(d));
  // x-axis: show every year on big, every 2nd on small to avoid overlap
  const xticks=big?YEARS:YEARS.filter((d,i)=>i%2===0||d===Y1);
  svg.append("g").attr("class","axis").attr("transform",`translate(0,${H-m.b})`).call(d3.axisBottom(x).tickValues(xticks).tickFormat(d3.format("d")).tickSizeOuter(0)).selectAll("text").attr("font-size",big?12:11);
  svg.append("g").attr("class","axis").attr("transform",`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSizeOuter(0)).selectAll("text").attr("font-size",big?12:11);
  svg.append("text").attr("x",m.l).attr("y",m.t-7).attr("font-size",11).attr("fill",C.ink60).text("Score");
  // current-year marker with label ABOVE the plot (no collision with axis)
  svg.append("line").attr("x1",x(year)).attr("x2",x(year)).attr("y1",m.t).attr("y2",H-m.b).attr("stroke",C.ink30).attr("stroke-dasharray","3 3");
  svg.append("rect").attr("x",x(year)-19).attr("y",m.t-17).attr("width",38).attr("height",15).attr("fill",C.paper);
  svg.append("text").attr("x",x(year)).attr("y",m.t-5).attr("text-anchor","middle").attr("font-size",11).attr("font-weight",700).attr("fill",C.ink).text(year);
  const line=d3.line().defined(d=>d.v!=null).x(d=>x(d.y)).y(d=>y(d.v)).curve(d3.curveMonotoneX);
  selected.forEach((n,i)=>{
    const sm=smap(n);const pts=YEARS.map(yy=>({y:yy,v:sm[yy]??null}));
    svg.append("path").datum(pts).attr("fill","none").attr("stroke",PALETTE[i]).attr("stroke-width",big?2.6:2.2).attr("d",line);
    const last=pts.filter(p=>p.v!=null).slice(-1)[0];
    if(last){svg.append("circle").attr("cx",x(last.y)).attr("cy",y(last.v)).attr("r",big?4:3.2).attr("fill",PALETTE[i]);
      svg.append("text").attr("class","endlabel").attr("x",x(last.y)+7).attr("y",y(last.v)+4).attr("fill",PALETTE[i]).attr("font-size",big?13:12).text(big?`${n} ${last.v.toFixed(2)}`:last.v.toFixed(2));}
    pts.filter(p=>p.v!=null).forEach(p=>{svg.append("circle").attr("cx",x(p.y)).attr("cy",y(p.v)).attr("r",big?9:7).attr("fill","transparent").style("cursor","pointer")
      .on("mousemove",function(e){const t=document.getElementById(tipId);const box=this.ownerSVGElement.getBoundingClientRect();t.style.display="block";t.style.left=(e.clientX-box.left+12)+"px";t.style.top=(e.clientY-box.top+12)+"px";t.innerHTML=`<strong>${n}</strong> · ${p.y} · ${p.v.toFixed(2)}`;})
      .on("mouseleave",()=>document.getElementById(tipId).style.display="none");});
  });
  if(!selected.length)svg.append("text").attr("x",W/2).attr("y",H/2).attr("text-anchor","middle").attr("fill",C.ink60).attr("font-size",12).text("Kein Land gewählt – in Tabelle oder Karte wählen");
}
function drawChart(){const W=document.getElementById("chart").clientWidth||620;const H=window.innerWidth<680?360:500;drawChartInto("#chart",W,H,false,"cmptip");}

// ============ view: map / bar / dist ============
const ALIAS={"United States of America":"United States","Dem. Rep. Congo":"Democratic Republic of Congo","Dominican Rep.":"Dominican Republic","Côte d'Ivoire":"Cote d'Ivoire","Bosnia and Herz.":"Bosnia and Herzegovina","Central African Rep.":"Central African Republic","eSwatini":"Eswatini","Macedonia":"North Macedonia","S. Sudan":"South Sudan"};
let geoFeatures=null;
function dName(p){const nm=p.name;return co[nm]?nm:(ALIAS[nm]||nm);}
function scoreAt2(nm){return co[nm]?interpScore(nm,yearF):null;}
function renderView(){
  [...document.querySelectorAll("#toggle button")].forEach(b=>b.classList.toggle("on",b.dataset.v===view));
  const vp=document.getElementById("viewport");
  vp.setAttribute("data-view",view);
  [...vp.querySelectorAll("svg,.legend")].forEach(e=>e.remove());
  const note=document.getElementById("filterNote");
  const mapctl=document.getElementById("mapctl");
  if(mapctl)mapctl.style.display=(view==="map")?"flex":"none";
  if(view==="map"){
    note.innerHTML=mapFilterActive?`<span class="dot"></span>Karte filtert aktiv <button class="clearfilter" id="cf">zurücksetzen</button>`:`<span class="dot"></span>Karte ist Filter – Klick wählt ein Land`;
    if(mapFilterActive){const cf=note.querySelector("#cf");if(cf)cf.onclick=()=>{selected=[];mapFilterActive=false;refreshAll();};}
    renderMap(vp);
  }else if(view==="bar"){note.innerHTML=`<span class="dot"></span>Balken anklickbar`;renderBarInto(vp);}
  else{note.innerHTML=`<span class="dot"></span>Punkte anklickbar`;renderDistInto(vp);}
}
function inWindow(s){return s!=null && s>=scoreWin[0] && s<=scoreWin[1];}
function renderMap(vp){
  const status=document.getElementById("mapStatus");if(!geoFeatures){if(status)status.style.display="flex";return;}if(status)status.remove();
  const W=vp.clientWidth||620,H=vp.clientHeight||540;
  const svg=d3.select(vp).insert("svg",".tip").attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet");
  const proj=d3.geoNaturalEarth1().fitExtent([[14,30],[W-14,H-30]],{type:"FeatureCollection",features:geoFeatures});const path=d3.geoPath(proj);
  const distort=distortMode!=="off";
  // scale factor per country for the cartogram-style distortion
  function scaleFor(s){
    if(!distort||s==null)return 1;
    let t=Math.max(0,Math.min(1,(s-GMIN)/(GMAX-GMIN))); // 0..1 over the GLOBAL score range (all years)
    if(distortMode==="unhappy")t=1-t;                    // invert: unhappiest country = emphasized
    // Reference = the global extreme (t=1) → MAX; the opposite extreme (t=0) → MIN.
    // gamma>1 keeps the mid-field small so ONLY the countries near the extreme blow up.
    const MIN=0.15, MAX=3.2, gamma=1.9;
    const e=Math.pow(t,gamma);
    return MIN+(MAX-MIN)*e;
  }
  svg.selectAll("path").data(geoFeatures).join("path").attr("class","country").attr("d",path)
    .attr("transform",function(f){
      if(!distort)return null;
      const nm=dName(f.properties),s=scoreAt2(nm);if(s==null)return null;
      const c=path.centroid(f);if(!isFinite(c[0]))return null;
      const k=scaleFor(s);
      return `translate(${c[0]},${c[1]}) scale(${k}) translate(${-c[0]},${-c[1]})`;
    })
    .attr("fill",f=>{const s=scoreAt2(dName(f.properties));return inWindow(s)?colorFor(s):"#ECEAE3";})
    .attr("opacity",f=>{const s=scoreAt2(dName(f.properties));return (s==null||inWindow(s))?1:0.25;})
    .attr("stroke",f=>selected.includes(dName(f.properties))?C.ink:"#fff").attr("stroke-width",f=>selected.includes(dName(f.properties))?1.4:0.4)
    .on("mousemove",function(e,f){const nm=dName(f.properties),s=scoreAt2(nm);const t=document.getElementById("viewtip");if(s!=null){const r=vp.getBoundingClientRect();t.style.display="block";t.style.left=Math.min(e.clientX-r.left+12,W-130)+"px";t.style.top=(e.clientY-r.top+12)+"px";t.innerHTML=`<strong>${nm}</strong> · ${s.toFixed(2)}`;}d3.select(this).attr("stroke",C.ink).attr("stroke-width",1.4).raise();})
    .on("mouseleave",function(e,f){document.getElementById("viewtip").style.display="none";const nm=dName(f.properties);d3.select(this).attr("stroke",selected.includes(nm)?C.ink:"#fff").attr("stroke-width",selected.includes(nm)?1.4:0.4);})
    .on("click",(e,f)=>{const nm=dName(f.properties);if(scoreAt2(nm)!=null){mapFilterActive=true;toggle(nm);}});
  // distorted countries should sort larger-on-top
  if(distort)svg.selectAll("path.country").sort((a,b)=>scaleFor(scoreAt2(dName(a.properties)))-scaleFor(scoreAt2(dName(b.properties))));
  const lg=document.createElement("div");lg.className="legend";let steps="";RAMP_DOM.forEach(s=>steps+=`<i style="background:${colorFor(s)}"></i>`);
  lg.innerHTML=`<div class="lt">Cantril-Score</div><div class="steps">${steps}</div><div class="nums"><span>2.5</span><span>5</span><span>7.8</span></div>`;vp.appendChild(lg);
}
function renderBarInto(vp){
  const W=vp.clientWidth||620,H=vp.clientHeight||540,m={t:14,r:60,b:14,l:130};const data=ranking(year).slice(0,25);
  const lo=d3.min(data,d=>d.score), hi=d3.max(data,d=>d.score);
  const base=Math.floor((lo-0.15)*10)/10;
  // cap plot width so bars aren't stretched edge-to-edge (better length comparison)
  const plotMax=Math.min(W-m.r, m.l+(W-m.l-m.r)*0.82);
  const svg=d3.select(vp).insert("svg",".tip").attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet");
  const y=d3.scaleBand().domain(data.map(d=>d.name)).range([m.t,H-m.b]).padding(0.3);const x=d3.scaleLinear().domain([base,Math.ceil(hi*10)/10]).range([m.l,plotMax]);
  // faint reference gridlines only (no axis labels — values are on the bars)
  svg.append("g").selectAll("line").data(x.ticks(5)).join("line").attr("class","gridline").attr("y1",m.t-2).attr("y2",H-m.b).attr("x1",d=>x(d)).attr("x2",d=>x(d)).attr("stroke-dasharray","2 3");
  svg.selectAll("rect").data(data).join("rect").attr("class","country").attr("x",m.l).attr("y",d=>y(d.name)).attr("height",y.bandwidth()).attr("width",d=>x(d.score)-m.l)
    .attr("fill",d=>selected.includes(d.name)?C.accent:C.ink).attr("opacity",d=>selected.includes(d.name)?1:.5)
    .on("click",(e,d)=>toggle(d.name))
    .on("mousemove",function(e,d){const t=document.getElementById("viewtip");const r=vp.getBoundingClientRect();t.style.display="block";t.style.left=Math.min(e.clientX-r.left+12,W-130)+"px";t.style.top=(e.clientY-r.top+12)+"px";t.innerHTML=`<strong>${d.name}</strong> · ${d.score.toFixed(2)}`;})
    .on("mouseleave",()=>document.getElementById("viewtip").style.display="none");
  svg.selectAll("text.l").data(data).join("text").attr("x",m.l-8).attr("y",d=>y(d.name)+y.bandwidth()/2+4).attr("text-anchor","end").attr("font-size",11.5).attr("fill",d=>selected.includes(d.name)?C.accent:C.ink60).attr("font-weight",d=>selected.includes(d.name)?700:400).text(d=>d.name);
  svg.selectAll("text.v").data(data).join("text").attr("x",d=>x(d.score)+7).attr("y",d=>y(d.name)+y.bandwidth()/2+4).attr("font-size",11.5).attr("fill",C.ink).attr("font-weight",600).attr("font-variant-numeric","tabular-nums").text(d=>d.score.toFixed(2));
}
function renderDistInto(vp){
  const W=vp.clientWidth||620,H=vp.clientHeight||540,m={t:34,r:26,b:48,l:26};const data=ranking(year);
  const svg=d3.select(vp).insert("svg",".tip").attr("viewBox",`0 0 ${W} ${H}`).attr("preserveAspectRatio","xMidYMid meet");const x=d3.scaleLinear().domain([1,8]).range([m.l,W-m.r]);
  // class separators at each integer score
  for(let s=2;s<=7;s++){svg.append("line").attr("x1",x(s)).attr("x2",x(s)).attr("y1",m.t).attr("y2",H-m.b).attr("stroke",C.hair).attr("stroke-width",1);}
  svg.append("g").attr("class","axis").attr("transform",`translate(0,${H-m.b})`).call(d3.axisBottom(x).ticks(8).tickSizeOuter(0)).selectAll("text").attr("font-size",12);
  svg.append("text").attr("x",W/2).attr("y",H-8).attr("text-anchor","middle").attr("font-size",12.5).attr("fill",C.ink60).text("Cantril-Ladder-Score →");
  const med=d3.median(data,d=>d.score);
  svg.append("line").attr("x1",x(med)).attr("x2",x(med)).attr("y1",m.t-6).attr("y2",H-m.b).attr("stroke",C.ink).attr("stroke-width",1.5).attr("stroke-dasharray","4 3");
  svg.append("text").attr("x",x(med)).attr("y",m.t-11).attr("text-anchor","middle").attr("font-size",12.5).attr("font-weight",700).attr("fill",C.ink).text("Median "+med.toFixed(2));
  // bigger dots, fewer wider bins for clearer columns & easier hover
  const r=7, gap=1.5, step=r*2+gap, maxPer=Math.floor((H-m.b-m.t)/step);
  const nbins=Math.round((8-1)/0.25);
  const bins=d3.bin().domain([1,8]).thresholds(x.ticks(nbins))(data.map(d=>d.score));const dots=[];
  bins.forEach(b=>{const arr=data.filter(d=>d.score>=b.x0&&d.score<b.x1);arr.forEach((d,i)=>dots.push({d,cx:x((b.x0+b.x1)/2),cy:H-m.b-r-(i%maxPer)*step}));});
  svg.selectAll("circle").data(dots).join("circle").attr("class","country").attr("cx",d=>d.cx).attr("cy",d=>d.cy).attr("r",r)
    .attr("fill",d=>selected.includes(d.d.name)?C.accent:colorFor(d.d.score)).attr("stroke",d=>selected.includes(d.d.name)?C.ink:"#fff").attr("stroke-width",d=>selected.includes(d.d.name)?1.6:.8)
    .on("click",(e,d)=>toggle(d.d.name))
    .on("mousemove",function(e,d){const t=document.getElementById("viewtip");const rr=vp.getBoundingClientRect();t.style.display="block";t.style.left=Math.min(e.clientX-rr.left+14,W-140)+"px";t.style.top=(e.clientY-rr.top+14)+"px";t.innerHTML=`<strong>${d.d.name}</strong> · ${d.d.score.toFixed(2)}`;d3.select(this).attr("stroke",C.ink).attr("stroke-width",1.6).raise();})
    .on("mouseleave",function(e,d){document.getElementById("viewtip").style.display="none";d3.select(this).attr("stroke",selected.includes(d.d.name)?C.ink:"#fff").attr("stroke-width",selected.includes(d.d.name)?1.6:.8);})
    .style("cursor","pointer");
}
document.getElementById("toggle").onclick=e=>{const b=e.target.closest("button");if(!b)return;view=b.dataset.v;updateMessages();renderView();};
// distortion toggle
document.getElementById("distortToggle").onclick=e=>{const b=e.target.closest("button");if(!b)return;distortMode=b.dataset.d;[...document.querySelectorAll("#distortToggle button")].forEach(x=>x.classList.toggle("on",x.dataset.d===distortMode));renderView();};
// dual score-window slider
(function(){
  const lo=document.getElementById("dualLo"),hi=document.getElementById("dualHi"),fill=document.getElementById("dualFill");
  const bubLo=document.getElementById("bubLo"),bubHi=document.getElementById("bubHi");
  const min=1,max=8;
  function pct(v){return (v-min)/(max-min)*100;}
  function upd(){
    let a=+lo.value,b=+hi.value; if(a>b){[a,b]=[b,a];}
    scoreWin=[a,b];
    fill.style.left=pct(a)+"%";
    fill.style.right=(100-pct(b))+"%";
    bubLo.style.left=pct(+lo.value)+"%";bubLo.textContent=(+lo.value).toFixed(1);
    bubHi.style.left=pct(+hi.value)+"%";bubHi.textContent=(+hi.value).toFixed(1);
    if(view==="map")renderView();
  }
  function activate(which){bubLo.classList.toggle("active",which==="lo");bubHi.classList.toggle("active",which==="hi");}
  function clearActive(){bubLo.classList.remove("active");bubHi.classList.remove("active");}
  lo.addEventListener("input",()=>{activate("lo");upd();});
  hi.addEventListener("input",()=>{activate("hi");upd();});
  ["pointerdown","focus"].forEach(ev=>{lo.addEventListener(ev,()=>activate("lo"));hi.addEventListener(ev,()=>activate("hi"));});
  ["pointerup","blur","mouseleave"].forEach(ev=>{lo.addEventListener(ev,clearActive);hi.addEventListener(ev,clearActive);});
  upd();
})();

// ============ modal ============
function refreshAll(){buildKPIs();updateMessages();drawTrack();renderTables();renderChips();drawChart();renderView();}
initSortHeaders();

d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(topo=>{geoFeatures=topojson.feature(topo,topo.objects.countries).features;renderView();}).catch(()=>{const s=document.getElementById("mapStatus");if(s)s.textContent="Karte nicht ladbar (CDN offline) – Balken & Verteilung funktionieren weiter.";});
refreshAll();
let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{drawTrack();drawChart();renderView();},160);});
