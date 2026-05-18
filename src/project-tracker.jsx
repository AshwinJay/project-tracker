import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const LT={bg:"#f5f3f0",surface:"#ffffff",surfaceAlt:"#edeae6",border:"#d9d5cf",text:"#1a1816",textMuted:"#7a7570",textFaint:"#a8a29e",accent:"#c45d3e",accentSoft:"rgba(196,93,62,0.12)",green:"#3a8a5c",greenSoft:"rgba(58,138,92,0.12)",amber:"#b8860b",amberSoft:"rgba(184,134,11,0.12)",red:"#c43e3e",redSoft:"rgba(196,62,62,0.12)",blue:"#3e7cc4",blueSoft:"rgba(62,124,196,0.12)",hillFill:"rgba(196,93,62,0.06)",hillStroke:"#c45d3e",burnIdeal:"#d9d5cf",burnActual:"#c45d3e",burnFill:"rgba(196,93,62,0.08)",shadow:"0 1px 3px rgba(0,0,0,0.06)",grid:"#edeae6",glow:"rgba(196,93,62,0.35)"};
const DK={bg:"#111110",surface:"#1c1b1a",surfaceAlt:"#252423",border:"#333231",text:"#e8e4df",textMuted:"#8a8580",textFaint:"#5a5550",accent:"#e07858",accentSoft:"rgba(224,120,88,0.15)",green:"#5cb87a",greenSoft:"rgba(92,184,122,0.15)",amber:"#d4a017",amberSoft:"rgba(212,160,23,0.15)",red:"#e05858",redSoft:"rgba(224,88,88,0.15)",blue:"#58a0e0",blueSoft:"rgba(88,160,224,0.15)",hillFill:"rgba(224,120,88,0.08)",hillStroke:"#e07858",burnIdeal:"#333231",burnActual:"#e07858",burnFill:"rgba(224,120,88,0.1)",shadow:"0 1px 3px rgba(0,0,0,0.3)",grid:"#252423",glow:"rgba(224,120,88,0.45)"};
const FT=`'DM Sans','Segoe UI',system-ui,sans-serif`,MO=`'DM Mono',ui-monospace,monospace`;

const DEF_PROJECT={title:"Acme · Platform Rebuild",cycle:"Cycle 4",startDate:"2026-05-05",endDate:"2026-06-27",currentWeek:6,bufferDays:12,slippageDays:4};
const DEF_SCOPES=[
  {id:"s1",name:"Auth & Permissions",hill:.82,status:"on-track",owner:"MR",startWeek:1,endWeek:5,history:[.1,.25,.4,.58,.72,.82]},
  {id:"s2",name:"Data Pipeline",hill:.55,status:"on-track",owner:"KL",startWeek:1,endWeek:7,history:[.08,.15,.28,.38,.48,.55]},
  {id:"s3",name:"Dashboard UI",hill:.35,status:"at-risk",owner:"JT",startWeek:2,endWeek:8,history:[.05,.12,.18,.24,.35]},
  {id:"s4",name:"Notifications",hill:.18,status:"on-track",owner:"AS",startWeek:3,endWeek:9,history:[.04,.09,.18]},
  {id:"s5",name:"Reporting Engine",hill:.68,status:"blocked",owner:"DP",startWeek:1,endWeek:6,history:[.1,.22,.38,.55,.65,.68]},
  {id:"s6",name:"API v2 Migration",hill:.92,status:"on-track",owner:"MR",startWeek:1,endWeek:4,history:[.2,.4,.6,.78,.88,.92]},
  {id:"s7",name:"Search & Filters",hill:.45,status:"on-track",owner:"KL",startWeek:2,endWeek:10,history:[.05,.15,.28,.38,.45]},
];
const DEF_RISKS=[
  {id:"r1",title:"3rd-party API deprecation",prob:"high",impact:"high",mitigation:"Abstract adapter layer; fallback provider identified",owner:"DP"},
  {id:"r2",title:"Designer capacity Q3",prob:"medium",impact:"medium",mitigation:"Contract designer on standby",owner:"JT"},
  {id:"r3",title:"Perf regression on large datasets",prob:"medium",impact:"high",mitigation:"Load test suite in CI; query optimization sprint planned",owner:"KL"},
  {id:"r4",title:"Scope creep from stakeholder feedback",prob:"high",impact:"medium",mitigation:"Change board process in place; weekly scope review",owner:"MR"},
];
const DEF_CHANGES=[
  {id:"c1",date:"May 02",title:"Add export-to-CSV",impact:"+2d",status:"approved",scope:"Reporting Engine"},
  {id:"c2",date:"May 06",title:"SSO requirement added",impact:"+3d",status:"approved",scope:"Auth & Permissions"},
  {id:"c3",date:"May 10",title:"Remove legacy widget support",impact:"-4d",status:"approved",scope:"Dashboard UI"},
  {id:"c4",date:"May 14",title:"Real-time collab editing",impact:"+5d",status:"pending",scope:"Dashboard UI"},
  {id:"c5",date:"May 16",title:"Webhook retry logic",impact:"+1d",status:"rejected",scope:"Notifications"},
];

function weeksFrom(s,e){try{return Math.max(1,Math.ceil((new Date(e)-new Date(s))/(7*864e5)))}catch{return 8}}
function fmtD(iso){try{return new Date(iso+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch{return iso}}
function parseImpactDays(str){const n=parseInt(str.replace(/[^\-\d]/g,""),10);return isNaN(n)?0:n}

const SK="project-tracker-v6";
async function load(){try{const r=await window.storage.get(SK);return r?JSON.parse(r.value):null}catch{return null}}
async function save(d){try{await window.storage.set(SK,JSON.stringify(d))}catch{}}

/* ─── Sparkline ─── */
function Sparkline({data,width=48,height=14,color}){
  if(!data||data.length<2) return <div style={{width,height}}/>;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-v*height}`);
  return <svg width={width} height={height} style={{display:"block",flexShrink:0}}>
    <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={parseFloat(pts[pts.length-1])} cy={parseFloat(pts[pts.length-1].split(",")[1])} r="2" fill={color}/>
  </svg>;
}

/* ─── Hill Chart ─── */
function HillChart({scopes,theme,onUpdateHill,selectedId,onSelect}){
  const ref=useRef(null),dragId=useRef(null);
  const W=640,H=210,P=28;
  const hY=useCallback(px=>{const n=(px-P)/(W-2*P);return H-P-(Math.sin(Math.max(0,Math.min(1,n))*Math.PI)*(H-2*P-24))},[]);
  const toH=useCallback(cx=>{const svg=ref.current;if(!svg)return 0;const r=svg.getBoundingClientRect();const sx=((cx-r.left)/r.width)*W;return Math.max(0,Math.min(1,(sx-P)/(W-2*P)))},[]);
  const pathD=useMemo(()=>Array.from({length:W-2*P+1},(_,i)=>{const x=i+P;return`${i===0?"M":"L"}${x},${hY(x)}`}).join(" "),[hY]);
  return <svg ref={ref} viewBox={`0 0 ${W} ${H+10}`} style={{width:"100%",height:"auto",cursor:dragId.current?"grabbing":"default",touchAction:"none"}}
    onPointerMove={e=>{if(dragId.current)onUpdateHill(dragId.current,toH(e.clientX))}}
    onPointerUp={()=>{dragId.current=null}} onPointerLeave={()=>{dragId.current=null}}>
    <path d={`${pathD} L${W-P},${H-P} L${P},${H-P} Z`} fill={theme.hillFill}/>
    <path d={pathD} fill="none" stroke={theme.hillStroke} strokeWidth="2" opacity=".35"/>
    <line x1={W/2} y1={P-14} x2={W/2} y2={H-P} stroke={theme.border} strokeDasharray="4 4"/>
    <text x={W*.25} y={H} textAnchor="middle" fill={theme.textFaint} fontSize="10" fontFamily={FT}>Figuring things out</text>
    <text x={W*.75} y={H} textAnchor="middle" fill={theme.textFaint} fontSize="10" fontFamily={FT}>Making it happen</text>
    {scopes.map(s=>{
      const hill=Math.max(0,Math.min(1,s.hill));
      const px=P+hill*(W-2*P),py=hY(px);
      const col=s.status==="blocked"?theme.red:s.status==="at-risk"?theme.amber:theme.accent;
      const sel=s.id===selectedId;
      const labelY=(hill<=.03||hill>=.97)?py-20:py-16;
      return <g key={s.id} style={{cursor:"grab"}}
        onPointerDown={e=>{e.preventDefault();e.stopPropagation();onSelect(s.id);dragId.current=s.id}}>
        {sel&&<circle cx={px} cy={py} r="16" fill="none" stroke={col} strokeWidth="2" strokeDasharray="3 2" opacity=".5"><animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite"/></circle>}
        {dragId.current===s.id&&<circle cx={px} cy={py} r="22" fill={theme.glow}/>}
        <circle cx={px} cy={py} r="10" fill={col} opacity=".92"/>
        <text x={px} y={py+.5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="8" fontWeight="700" fontFamily={MO}>{s.owner}</text>
        <text x={px} y={labelY} textAnchor="middle" fill={theme.text} fontSize="9.5" fontWeight="500" fontFamily={FT}>{s.name}</text>
      </g>})}
  </svg>;
}

/* ─── Timeline ─── */
function Timeline({scopes,theme,currentWeek,totalWeeks}){
  const maxW=Math.max(totalWeeks,...scopes.map(s=>s.endWeek));
  return <div style={{overflowX:"auto"}}>
    <div style={{display:"grid",gridTemplateColumns:`130px repeat(${maxW},1fr)`,gap:"1px 0",minWidth:Math.max(520,maxW*50),alignItems:"center"}}>
      <div style={{fontSize:10,fontWeight:600,color:theme.textMuted,padding:"6px 8px"}}>Scope</div>
      {Array.from({length:maxW},(_,i)=>{const w=i+1,cur=w===currentWeek,over=w>totalWeeks;
        return <div key={i} style={{fontSize:9,color:cur?theme.accent:over?theme.red:theme.textFaint,fontWeight:cur?700:400,textAlign:"center",padding:"6px 0",fontFamily:MO,background:cur?theme.accentSoft:over?"rgba(196,62,62,0.05)":"transparent",borderRadius:6}}>W{w}</div>})}
      {scopes.map(s=>{const col=s.status==="blocked"?theme.red:s.status==="at-risk"?theme.amber:theme.green;
        const bgC=s.status==="blocked"?theme.redSoft:s.status==="at-risk"?theme.amberSoft:theme.greenSoft;
        const over=s.endWeek>totalWeeks;
        return [
          <div key={s.id+"n"} style={{fontSize:11,fontWeight:500,padding:"7px 8px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:over?theme.amber:theme.text}}>{s.name}{over?" ⚠":""}</div>,
          ...Array.from({length:maxW},(_,i)=>{const w=i+1,inR=w>=s.startWeek&&w<=s.endWeek,isS=w===s.startWeek,isE=w===s.endWeek;
            const span=s.endWeek-s.startWeek+1,wIn=w-s.startWeek,fill=Math.max(0,Math.min(1,(s.hill*span-wIn)));
            const beyondB=w>totalWeeks&&inR;
            return <div key={s.id+i} style={{padding:"7px 1px",position:"relative"}}>
              {inR&&<div style={{height:12,borderRadius:isS&&isE?6:isS?"6px 0 0 6px":isE?"0 6px 6px 0":0,background:beyondB?"rgba(196,62,62,0.12)":bgC,position:"relative",overflow:"hidden",border:beyondB?`1px dashed ${theme.red}`:"none"}}>
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${fill*100}%`,background:col,opacity:.65,borderRadius:isS&&isE?6:isS?"6px 0 0 6px":fill>=1&&isE?"0 6px 6px 0":0}}/>
              </div>}
              {w===currentWeek&&<div style={{position:"absolute",top:3,bottom:3,left:"50%",width:2,background:theme.accent,opacity:.5,borderRadius:1,transform:"translateX(-1px)"}}/>}
            </div>})
        ]})}
    </div>
  </div>;
}

/* ─── Burndown ─── */
function makeBurndown(totalW,curW,actuals){
  const maxW=Math.max(totalW,...Object.keys(actuals).map(Number));
  return Array.from({length:maxW},(_,i)=>{const w=i+1;return{day:`W${w}`,ideal:Math.max(0,Math.round(100-(100/totalW)*i)),actual:w<=curW?(actuals[w]??null):null}});
}

/* ─── UI atoms ─── */
const Pill=({label,color,bg,onClick})=><span onClick={onClick} style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:99,color,background:bg,textTransform:"uppercase",letterSpacing:".04em",cursor:onClick?"pointer":"default",whiteSpace:"nowrap"}}>{label}</span>;
function Modal({children,onClose,theme}){return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}>
  <div onClick={e=>e.stopPropagation()} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:14,padding:24,maxWidth:440,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>{children}</div></div>}
function Field({label,value,onChange,theme,type="text",options,placeholder,hint}){
  const base={width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${theme.border}`,background:theme.surfaceAlt,color:theme.text,fontSize:13,fontFamily:FT,outline:"none",boxSizing:"border-box"};
  return <label style={{display:"block",marginBottom:12}}>
    <div style={{fontSize:10,fontWeight:600,color:theme.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:".04em"}}>{label}</div>
    {options?<select value={value} onChange={e=>onChange(e.target.value)} style={{...base,cursor:"pointer"}}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>
      :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base}/>}
    {hint&&<div style={{fontSize:10,color:theme.textFaint,marginTop:3,lineHeight:1.4}}>{hint}</div>}
  </label>}
const Btn=({children,onClick,theme,variant="primary"})=><button onClick={onClick} style={{width:"100%",padding:"10px",borderRadius:10,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:FT,marginTop:4,background:variant==="primary"?theme.accent:theme.surfaceAlt,color:variant==="primary"?"#fff":theme.text}}>{children}</button>;
function HelpBanner({text,theme}){return <div style={{fontSize:11,color:theme.textMuted,lineHeight:1.5,padding:"10px 12px",background:theme.surfaceAlt,borderRadius:8,marginBottom:12,borderLeft:`3px solid ${theme.accent}`}}>{text}</div>}

/* ═══════════════════ MAIN ═══════════════════ */
export default function App(){
  const [dark,setDark]=useState(()=>window.matchMedia?.("(prefers-color-scheme:dark)").matches??false);
  const [tab,setTab]=useState("hill");
  const [project,setProject]=useState(DEF_PROJECT);
  const [scopes,setScopes]=useState(DEF_SCOPES);
  const [risks,setRisks]=useState(DEF_RISKS);
  const [changes,setChanges]=useState(DEF_CHANGES);
  const [loaded,setLoaded]=useState(false);
  const [selScope,setSelScope]=useState(null);
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const t=dark?DK:LT;

  const totalWeeks=useMemo(()=>weeksFrom(project.startDate,project.endDate),[project.startDate,project.endDate]);
  const curW=project.currentWeek;
  const maxW=useMemo(()=>Math.max(totalWeeks,...scopes.map(s=>s.endWeek)),[totalWeeks,scopes]);
  const overScopes=useMemo(()=>scopes.filter(s=>s.endWeek>totalWeeks),[scopes,totalWeeks]);

  // ─── Buffer: auto-calculated ───
  const scopeChangeDays=useMemo(()=>{
    const adds=changes.filter(c=>c.status==="approved").reduce((s,c)=>{const d=parseImpactDays(c.impact);return d>0?s+d:s},0);
    const saves=changes.filter(c=>c.status==="approved").reduce((s,c)=>{const d=parseImpactDays(c.impact);return d<0?s+Math.abs(d):s},0);
    const net=changes.filter(c=>c.status==="approved").reduce((s,c)=>s+parseImpactDays(c.impact),0);
    return {adds,saves,net};
  },[changes]);
  const slippageDays=project.slippageDays||0;
  const bufferTotal=project.bufferDays||0;
  const bufferUsed=Math.max(0,scopeChangeDays.net+slippageDays);
  const bufferRem=Math.max(0,bufferTotal-bufferUsed);
  const bufferPct=bufferTotal>0?(bufferUsed/bufferTotal)*100:0;
  const bufferOver=bufferUsed>bufferTotal;

  const burnActuals=useMemo(()=>({1:100,2:92,3:81,4:73,5:62,6:48}),[]);
  const burnData=useMemo(()=>makeBurndown(totalWeeks,curW,burnActuals),[totalWeeks,curW,burnActuals,maxW]);

  // ─── Persist ───
  useEffect(()=>{load().then(d=>{if(d){d.project&&setProject(d.project);d.scopes&&setScopes(d.scopes);d.risks&&setRisks(d.risks);d.changes&&setChanges(d.changes)}setLoaded(true)})},[]);
  useEffect(()=>{if(loaded)save({project,scopes,risks,changes})},[project,scopes,risks,changes,loaded]);

  const onUpdateHill=useCallback((id,val)=>{
    setScopes(p=>p.map(s=>{if(s.id!==id)return s;const h=[...(s.history||[])];h[h.length-1]=Math.round(val*100)/100;return{...s,hill:Math.round(val*100)/100,history:h}}));
  },[]);

  const counts=useMemo(()=>{const c={"on-track":0,"at-risk":0,"blocked":0};scopes.forEach(s=>c[s.status]++);return c},[scopes]);
  const cycleStatus=id=>setScopes(p=>p.map(s=>s.id!==id?s:{...s,status:["on-track","at-risk","blocked"][(["on-track","at-risk","blocked"].indexOf(s.status)+1)%3]}));
  const cycleCStatus=id=>setChanges(p=>p.map(c=>c.id!==id?c:{...c,status:["pending","approved","rejected"][(["pending","approved","rejected"].indexOf(c.status)+1)%3]}));

  const openAddScope=()=>{setForm({name:"",owner:"",startWeek:String(curW),endWeek:String(totalWeeks)});setModal("add-scope")};
  const openEditScope=(s)=>{setForm({id:s.id,name:s.name,owner:s.owner,startWeek:String(s.startWeek),endWeek:String(s.endWeek),status:s.status});setModal("edit-scope")};
  const saveScope=()=>{
    if(modal==="add-scope"){
      setScopes(p=>[...p,{id:`s${Date.now()}`,name:form.name||"New Scope",hill:.05,status:"on-track",owner:(form.owner||"??").slice(0,2).toUpperCase(),startWeek:parseInt(form.startWeek)||curW,endWeek:parseInt(form.endWeek)||totalWeeks,history:[.05]}]);
    } else {
      setScopes(p=>p.map(s=>s.id!==form.id?s:{...s,name:form.name||s.name,owner:(form.owner||s.owner).slice(0,2).toUpperCase(),startWeek:parseInt(form.startWeek)||s.startWeek,endWeek:parseInt(form.endWeek)||s.endWeek,status:form.status||s.status}));
    }
    setModal(null);
  };
  const addRisk=()=>{setRisks(p=>[...p,{id:`r${Date.now()}`,title:form.title||"New Risk",prob:form.prob||"medium",impact:form.impact||"medium",mitigation:form.mitigation||"",owner:form.owner||"??"}]);setModal(null)};
  const addChange=()=>{setChanges(p=>[...p,{id:`c${Date.now()}`,date:form.date||new Date().toLocaleDateString("en-US",{month:"short",day:"2-digit"}),title:form.title||"New Change",impact:form.impact||"+0d",status:"pending",scope:form.scope||""}]);setModal(null)};
  const snapshot=()=>setScopes(p=>p.map(s=>({...s,history:[...(s.history||[]),s.hill]})));
  const resetAll=()=>{setProject(DEF_PROJECT);setScopes(DEF_SCOPES);setRisks(DEF_RISKS);setChanges(DEF_CHANGES)};

  const openProject=()=>{setForm({title:project.title,cycle:project.cycle,startDate:project.startDate,endDate:project.endDate,currentWeek:String(project.currentWeek),bufferDays:String(project.bufferDays||0),slippageDays:String(project.slippageDays||0)});setModal("project")};
  const saveProject=()=>{setProject({title:form.title||project.title,cycle:form.cycle||project.cycle,startDate:form.startDate||project.startDate,endDate:form.endDate||project.endDate,currentWeek:parseInt(form.currentWeek)||1,bufferDays:parseInt(form.bufferDays)||0,slippageDays:parseInt(form.slippageDays)||0});setModal(null)};

  const tabs=[{id:"hill",label:"Hill Chart"},{id:"timeline",label:"Timeline"},{id:"burndown",label:"Burndown"},{id:"risks",label:`Risks (${risks.length})`},{id:"changes",label:`Changes${changes.some(c=>c.status==="pending")?" ●":""}`}];

  if(!loaded) return <div style={{fontFamily:FT,background:t.bg,color:t.textMuted,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>Loading…</div>;

  return <div style={{fontFamily:FT,background:t.bg,color:t.text,minHeight:"100vh",padding:"20px 14px",transition:"background .3s,color .3s"}}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

    {/* Header */}
    <div style={{maxWidth:860,margin:"0 auto 16px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
      <div onClick={openProject} style={{cursor:"pointer"}} title="Click to edit project settings">
        <h1 style={{fontSize:21,fontWeight:700,margin:0,letterSpacing:"-.02em",display:"flex",alignItems:"center",gap:6}}>
          {project.title} <span style={{fontSize:13,color:t.textFaint,fontWeight:400}}>✎</span>
        </h1>
        <p style={{margin:"2px 0 0",color:t.textMuted,fontSize:12}}>
          {project.cycle} · {fmtD(project.startDate)} – {fmtD(project.endDate)} · Week {curW} of {totalWeeks}
          {overScopes.length>0&&<span style={{color:t.amber,fontWeight:600}}> · {overScopes.length} scope{overScopes.length>1?"s":""} past deadline</span>}
        </p>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        <button onClick={snapshot} title="Record hill positions as new sparkline data point" style={{background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 10px",color:t.textMuted,cursor:"pointer",fontSize:11,fontFamily:FT,fontWeight:600}}>📸 Snapshot</button>
        <button onClick={resetAll} style={{background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 10px",color:t.textMuted,cursor:"pointer",fontSize:11,fontFamily:FT}}>↺ Reset</button>
        <button onClick={()=>setDark(!dark)} style={{background:t.surfaceAlt,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 10px",color:t.textMuted,cursor:"pointer",fontSize:12,fontFamily:FT}}>{dark?"☀":"●"}</button>
      </div>
    </div>

    {/* Summary cards */}
    <div style={{maxWidth:860,margin:"0 auto 12px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
      {[
        {l:"On Track",v:counts["on-track"],c:t.green,b:t.greenSoft},
        {l:"At Risk",v:counts["at-risk"],c:t.amber,b:t.amberSoft},
        {l:"Blocked",v:counts["blocked"],c:t.red,b:t.redSoft},
        {l:"Buffer",v:bufferOver?`-${bufferUsed-bufferTotal}d`:`${bufferRem}d`,c:bufferOver?t.red:bufferPct>70?t.amber:t.blue,b:bufferOver?t.redSoft:bufferPct>70?t.amberSoft:t.blueSoft},
      ].map(({l,v,c,b})=>(
        <div key={l} onClick={l==="Buffer"?openProject:undefined} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,padding:"11px 12px",boxShadow:t.shadow,cursor:l==="Buffer"?"pointer":"default"}}>
          <div style={{fontSize:9,color:t.textMuted,marginBottom:2,textTransform:"uppercase",letterSpacing:".06em",fontWeight:500}}>{l}{l==="Buffer"?bufferOver?" OVERRUN":" left":""}</div>
          <div style={{fontSize:22,fontWeight:700,color:c,fontFamily:MO}}>{v}</div>
        </div>
      ))}
    </div>

    {/* Buffer bar — auto-calculated */}
    <div style={{maxWidth:860,margin:"0 auto 14px",background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 14px",boxShadow:t.shadow}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:4}}>
        <span style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em"}}>Schedule Buffer</span>
        <span style={{fontSize:10,color:t.textMuted}}>{bufferUsed}d consumed of {bufferTotal}d planned</span>
      </div>
      <div style={{height:6,borderRadius:6,background:t.surfaceAlt,overflow:"hidden",position:"relative"}}>
        <div style={{height:"100%",width:`${Math.min(bufferPct,100)}%`,borderRadius:6,background:bufferOver?t.red:bufferPct>70?t.red:bufferPct>50?t.amber:t.accent,transition:"width .4s"}}/>
      </div>
      {/* Breakdown */}
      <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:8,height:8,borderRadius:2,background:scopeChangeDays.net>0?t.red:scopeChangeDays.net<0?t.green:t.textFaint}}/>
          <span style={{fontSize:10,color:t.textMuted}}>Scope changes: <span style={{fontFamily:MO,fontWeight:700,color:scopeChangeDays.net>0?t.red:scopeChangeDays.net<0?t.green:t.textMuted}}>{scopeChangeDays.net>0?"+":""}{scopeChangeDays.net}d</span></span>
          <span style={{fontSize:9,color:t.textFaint}}>({scopeChangeDays.adds}d added, {scopeChangeDays.saves}d saved)</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:8,height:8,borderRadius:2,background:slippageDays>0?t.amber:t.textFaint}}/>
          <span style={{fontSize:10,color:t.textMuted}}>Slippage: <span style={{fontFamily:MO,fontWeight:700,color:slippageDays>0?t.amber:t.textMuted}}>+{slippageDays}d</span></span>
          <span style={{fontSize:9,color:t.textFaint}}>(manual, edit in settings)</span>
        </div>
      </div>
      {bufferOver&&<div style={{fontSize:11,color:t.red,marginTop:6,fontWeight:600}}>⚠ Buffer exceeded by {bufferUsed-bufferTotal}d — deadline at risk without intervention.</div>}
    </div>

    {/* Tabs */}
    <div style={{maxWidth:860,margin:"0 auto 12px",display:"flex",gap:2,background:t.surfaceAlt,borderRadius:10,padding:3,overflowX:"auto"}}>
      {tabs.map(tb=><button key={tb.id} onClick={()=>setTab(tb.id)} style={{
        flex:1,padding:"7px 0",border:"none",borderRadius:8,cursor:"pointer",fontFamily:FT,minWidth:0,
        fontSize:11,fontWeight:600,transition:"all .2s",whiteSpace:"nowrap",
        background:tab===tb.id?t.surface:"transparent",color:tab===tb.id?t.text:t.textMuted,
        boxShadow:tab===tb.id?t.shadow:"none",
      }}>{tb.label}</button>)}
    </div>

    {/* ── Panels ── */}
    <div style={{maxWidth:860,margin:"0 auto"}}>

      {/* HILL CHART */}
      {tab==="hill"&&<div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px 16px 20px",boxShadow:t.shadow}}>
        <HelpBanner theme={t} text="Left side = still figuring out the approach. Right side = known work, executing. Drag dots to update. Tap ✎ to edit a scope's details. Tap the status pill to cycle on-track → at-risk → blocked."/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <h2 style={{fontSize:13,fontWeight:600,margin:0}}>Scope Progress</h2>
          <button onClick={openAddScope} style={{background:t.accentSoft,color:t.accent,border:"none",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FT}}>+ Scope</button>
        </div>
        <HillChart scopes={scopes} theme={t} onUpdateHill={onUpdateHill} selectedId={selScope} onSelect={setSelScope}/>
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:4}}>
          {[...scopes].sort((a,b)=>b.hill-a.hill).map(s=>{
            const col=s.status==="blocked"?t.red:s.status==="at-risk"?t.amber:t.green;
            const bg2=s.status==="blocked"?t.redSoft:s.status==="at-risk"?t.amberSoft:t.greenSoft;
            const over=s.endWeek>totalWeeks;
            return <div key={s.id} onClick={()=>setSelScope(s.id===selScope?null:s.id)} style={{
              display:"flex",alignItems:"center",gap:7,padding:"6px 10px",borderRadius:8,
              background:s.id===selScope?t.accentSoft:t.surfaceAlt,cursor:"pointer",transition:"background .15s"
            }}>
              <span style={{width:24,height:24,borderRadius:"50%",background:t.accentSoft,color:t.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,fontFamily:MO,flexShrink:0}}>{s.owner}</span>
              <span style={{flex:1,fontSize:12,fontWeight:500,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {s.name}{over&&<span style={{color:t.amber,fontSize:10,fontWeight:600}}> (→W{s.endWeek})</span>}
              </span>
              <Sparkline data={s.history} width={48} height={14} color={col}/>
              <span style={{fontSize:10,fontFamily:MO,color:t.textMuted,width:30,textAlign:"right"}}>{Math.round(s.hill*100)}%</span>
              <Pill label={s.status.replace("-"," ")} color={col} bg={bg2} onClick={e=>{e.stopPropagation();cycleStatus(s.id)}}/>
              <button onClick={e=>{e.stopPropagation();openEditScope(s)}} title="Edit scope" style={{background:"none",border:"none",color:t.textMuted,cursor:"pointer",fontSize:11,padding:"0 2px",lineHeight:1}}>✎</button>
              <button onClick={e=>{e.stopPropagation();setScopes(p=>p.filter(x=>x.id!==s.id))}} title="Delete" style={{background:"none",border:"none",color:t.textFaint,cursor:"pointer",fontSize:13,padding:"0 1px",lineHeight:1}}>×</button>
            </div>})}
        </div>
      </div>}

      {/* TIMELINE */}
      {tab==="timeline"&&<div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px 16px 20px",boxShadow:t.shadow}}>
        <HelpBanner theme={t} text="Bars show each scope's time window. Fill = progress from the hill chart. Orange marker = current week. Red dashed columns = past your cycle deadline."/>
        <h2 style={{fontSize:13,fontWeight:600,margin:"0 0 12px"}}>Timeline <span style={{fontWeight:400,color:t.textMuted,fontSize:11}}>— {totalWeeks} budgeted{maxW>totalWeeks?`, showing ${maxW}`:""}</span></h2>
        <Timeline scopes={scopes} theme={t} currentWeek={curW} totalWeeks={totalWeeks}/>
        {overScopes.length>0&&<p style={{fontSize:11,color:t.amber,marginTop:10,lineHeight:1.5,fontWeight:500}}>
          ⚠ {overScopes.map(s=>s.name).join(", ")} extend{overScopes.length===1?"s":""} past W{totalWeeks}.
        </p>}
      </div>}

      {/* BURNDOWN */}
      {tab==="burndown"&&<div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px 16px 20px",boxShadow:t.shadow}}>
        <HelpBanner theme={t} text="Ideal = even burn across the cycle. Actual = reality. The gap between them is schedule risk — that gap is what consumes your buffer as 'slippage' (adjustable in project settings)."/>
        <h2 style={{fontSize:13,fontWeight:600,margin:"0 0 12px"}}>Burndown</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={burnData} margin={{top:8,right:8,bottom:0,left:-20}}>
            <CartesianGrid stroke={t.grid} strokeDasharray="3 3"/>
            <XAxis dataKey="day" tick={{fill:t.textMuted,fontSize:10}} axisLine={{stroke:t.border}} tickLine={false}/>
            <YAxis tick={{fill:t.textMuted,fontSize:10}} axisLine={false} tickLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`}/>
            <Tooltip contentStyle={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,fontSize:11,fontFamily:FT}}/>
            {maxW>totalWeeks&&<ReferenceLine x={`W${totalWeeks+1}`} stroke={t.red} strokeDasharray="4 4" label={{value:"Deadline",fill:t.red,fontSize:9,fontFamily:FT}}/>}
            <ReferenceLine x={`W${curW}`} stroke={t.accent} strokeDasharray="4 4" label={{value:"Now",fill:t.accent,fontSize:10,fontFamily:FT}}/>
            <Area type="monotone" dataKey="ideal" stroke={t.burnIdeal} strokeWidth={2} strokeDasharray="6 4" fill="none" name="Ideal" dot={false}/>
            <Area type="monotone" dataKey="actual" stroke={t.burnActual} strokeWidth={2.5} fill={t.burnFill} name="Actual" dot={{r:3,fill:t.burnActual,stroke:t.surface,strokeWidth:2}} connectNulls={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>}

      {/* RISKS */}
      {tab==="risks"&&<div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px 16px 20px",boxShadow:t.shadow}}>
        <HelpBanner theme={t} text="Both probability and impact high = critical. Either one high = elevated. Otherwise moderate. Every risk should have a mitigation plan and an owner."/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <h2 style={{fontSize:13,fontWeight:600,margin:0}}>Risk Register</h2>
          <button onClick={()=>{setForm({title:"",prob:"medium",impact:"medium",mitigation:"",owner:""});setModal("add-risk")}}
            style={{background:t.accentSoft,color:t.accent,border:"none",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FT}}>+ Risk</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {risks.map(r=>{const sev=(r.prob==="high"&&r.impact==="high")?"critical":(r.prob==="high"||r.impact==="high")?"elevated":"moderate";
            const sc=sev==="critical"?t.red:sev==="elevated"?t.amber:t.blue;const sb=sev==="critical"?t.redSoft:sev==="elevated"?t.amberSoft:t.blueSoft;
            return <div key={r.id} style={{padding:"11px 13px",borderRadius:10,background:t.surfaceAlt,borderLeft:`3px solid ${sc}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:600}}>{r.title}</span>
                <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
                  <Pill label={sev} color={sc} bg={sb}/>
                  <button onClick={()=>setRisks(p=>p.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",color:t.textFaint,cursor:"pointer",fontSize:13,padding:0}}>×</button>
                </div>
              </div>
              <div style={{fontSize:10,color:t.textMuted,marginBottom:3}}>P: {r.prob} · I: {r.impact} · Owner: {r.owner}</div>
              <div style={{fontSize:11,color:t.textMuted,lineHeight:1.5}}><span style={{color:t.text,fontWeight:500}}>Mitigation:</span> {r.mitigation}</div>
            </div>})}
        </div>
      </div>}

      {/* CHANGES */}
      {tab==="changes"&&<div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px 16px 20px",boxShadow:t.shadow}}>
        <HelpBanner theme={t} text={`Log scope changes here. Each entry's schedule impact (+3d or -2d) feeds directly into the buffer bar. Tap the status pill to cycle: pending → approved → rejected. Only approved changes consume buffer. Current approved net: ${scopeChangeDays.net>0?"+":""}${scopeChangeDays.net}d.`}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
          <h2 style={{fontSize:13,fontWeight:600,margin:0}}>Change Log</h2>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:10,color:t.textMuted}}>Net approved: <span style={{color:scopeChangeDays.net>0?t.red:scopeChangeDays.net<0?t.green:t.textMuted,fontWeight:700,fontFamily:MO}}>{scopeChangeDays.net>0?"+":""}{scopeChangeDays.net}d</span></span>
            <button onClick={()=>{setForm({date:"",title:"",impact:"+0d",status:"pending",scope:""});setModal("add-change")}}
              style={{background:t.accentSoft,color:t.accent,border:"none",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FT}}>+ Change</button>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {changes.map(c=>{const stC=c.status==="approved"?t.green:c.status==="pending"?t.amber:t.textFaint;
            const stB=c.status==="approved"?t.greenSoft:c.status==="pending"?t.amberSoft:t.surfaceAlt;
            const neg=c.impact.includes("-");
            return <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:10,background:t.surfaceAlt}}>
              <span style={{fontSize:9,color:t.textFaint,fontFamily:MO,width:40,flexShrink:0}}>{c.date}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:500,marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</div>
                <div style={{fontSize:9,color:t.textMuted}}>{c.scope}</div>
              </div>
              <span style={{fontSize:12,fontWeight:700,fontFamily:MO,color:neg?t.green:t.red,flexShrink:0}}>{c.impact}</span>
              <Pill label={c.status} color={stC} bg={stB} onClick={()=>cycleCStatus(c.id)}/>
              <button onClick={()=>setChanges(p=>p.filter(x=>x.id!==c.id))} style={{background:"none",border:"none",color:t.textFaint,cursor:"pointer",fontSize:13,padding:0}}>×</button>
            </div>})}
        </div>
      </div>}
    </div>

    {/* ═══ MODALS ═══ */}

    {modal==="project"&&<Modal onClose={()=>setModal(null)} theme={t}>
      <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700}}>Project Settings</h3>
      <Field label="Project Title" value={form.title||""} onChange={v=>setForm(f=>({...f,title:v}))} theme={t}/>
      <Field label="Cycle / Sprint Name" value={form.cycle||""} onChange={v=>setForm(f=>({...f,cycle:v}))} theme={t} placeholder="e.g. Sprint 5, Cycle 4" hint="The named time-box this work lives in. Weeks subdivide it."/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Cycle Start" value={form.startDate||""} onChange={v=>setForm(f=>({...f,startDate:v}))} theme={t} type="date"/>
        <Field label="Cycle End" value={form.endDate||""} onChange={v=>setForm(f=>({...f,endDate:v}))} theme={t} type="date"/>
      </div>
      {form.startDate&&form.endDate&&<div style={{fontSize:11,color:t.textMuted,margin:"-4px 0 8px",padding:"6px 10px",background:t.surfaceAlt,borderRadius:6}}>
        = <strong>{weeksFrom(form.startDate,form.endDate)} weeks</strong>
      </div>}
      <Field label="Current Week" value={form.currentWeek||""} onChange={v=>setForm(f=>({...f,currentWeek:v}))} theme={t} type="number" hint="Which week you're in now. Positions the 'Now' marker."/>

      <div style={{borderTop:`1px solid ${t.border}`,margin:"16px 0",paddingTop:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Schedule Buffer</div>
        <Field label="Buffer planned (days)" value={form.bufferDays||""} onChange={v=>setForm(f=>({...f,bufferDays:v}))} theme={t} type="number" hint="Extra days built into the schedule for unknowns. Set this when planning your cycle — e.g. if you estimate 6 weeks of work but set an 8-week cycle, that's 10 days of buffer."/>
        <Field label="Slippage adjustment (days)" value={form.slippageDays||""} onChange={v=>setForm(f=>({...f,slippageDays:v}))} theme={t} type="number" hint="Manual adjustment for work taking longer than estimated — the non-scope-change reason buffer gets consumed. Update this as you go based on your burndown gap."/>

        {/* Live preview of buffer math */}
        {(()=>{
          const bTotal=parseInt(form.bufferDays)||0;
          const bSlip=parseInt(form.slippageDays)||0;
          const bScope=scopeChangeDays.net;
          const bUsed=Math.max(0,bScope+bSlip);
          const bLeft=Math.max(0,bTotal-bUsed);
          const bOver=bUsed>bTotal;
          return <div style={{padding:"10px 12px",background:t.surfaceAlt,borderRadius:8,marginBottom:4}}>
            <div style={{fontSize:11,fontWeight:600,marginBottom:6,color:bOver?t.red:t.text}}>Buffer Preview</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px",fontSize:11}}>
              <span style={{color:t.textMuted}}>Planned:</span><span style={{fontFamily:MO,fontWeight:600}}>{bTotal}d</span>
              <span style={{color:t.textMuted}}>Scope changes (auto):</span><span style={{fontFamily:MO,fontWeight:600,color:bScope>0?t.red:bScope<0?t.green:t.textMuted}}>{bScope>0?"+":""}{bScope}d</span>
              <span style={{color:t.textMuted}}>Slippage (manual):</span><span style={{fontFamily:MO,fontWeight:600,color:bSlip>0?t.amber:t.textMuted}}>+{bSlip}d</span>
              <span style={{color:t.textMuted,borderTop:`1px solid ${t.border}`,paddingTop:4}}>Consumed:</span><span style={{fontFamily:MO,fontWeight:700,borderTop:`1px solid ${t.border}`,paddingTop:4}}>{bUsed}d</span>
              <span style={{color:t.textMuted}}>Remaining:</span><span style={{fontFamily:MO,fontWeight:700,color:bOver?t.red:t.green}}>{bOver?`-${bUsed-bTotal}d (overrun)`:`${bLeft}d`}</span>
            </div>
          </div>;
        })()}
      </div>

      <Btn onClick={saveProject} theme={t}>Save Settings</Btn>
    </Modal>}

    {(modal==="add-scope"||modal==="edit-scope")&&<Modal onClose={()=>setModal(null)} theme={t}>
      <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700}}>{modal==="edit-scope"?"Edit Scope":"Add Scope"}</h3>
      <Field label="Name" value={form.name||""} onChange={v=>setForm(f=>({...f,name:v}))} theme={t}/>
      <Field label="Owner (initials)" value={form.owner||""} onChange={v=>setForm(f=>({...f,owner:v}))} theme={t}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Start Week" value={form.startWeek||""} onChange={v=>setForm(f=>({...f,startWeek:v}))} theme={t} type="number" hint={`Cycle runs W1–W${totalWeeks}`}/>
        <Field label="End Week" value={form.endWeek||""} onChange={v=>setForm(f=>({...f,endWeek:v}))} theme={t} type="number"/>
      </div>
      {parseInt(form.endWeek)>totalWeeks&&<div style={{fontSize:11,color:t.amber,margin:"-4px 0 8px",fontWeight:500}}>⚠ Past cycle deadline (W{totalWeeks})</div>}
      {modal==="edit-scope"&&<Field label="Status" value={form.status||"on-track"} onChange={v=>setForm(f=>({...f,status:v}))} theme={t} options={["on-track","at-risk","blocked"]}/>}
      <Btn onClick={saveScope} theme={t}>{modal==="edit-scope"?"Save Changes":"Add Scope"}</Btn>
    </Modal>}

    {modal==="add-risk"&&<Modal onClose={()=>setModal(null)} theme={t}>
      <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700}}>Add Risk</h3>
      <Field label="Title" value={form.title||""} onChange={v=>setForm(f=>({...f,title:v}))} theme={t} hint="What could go wrong?"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Probability" value={form.prob||"medium"} onChange={v=>setForm(f=>({...f,prob:v}))} theme={t} options={["low","medium","high"]}/>
        <Field label="Impact" value={form.impact||"medium"} onChange={v=>setForm(f=>({...f,impact:v}))} theme={t} options={["low","medium","high"]}/>
      </div>
      <Field label="Mitigation Plan" value={form.mitigation||""} onChange={v=>setForm(f=>({...f,mitigation:v}))} theme={t}/>
      <Field label="Owner" value={form.owner||""} onChange={v=>setForm(f=>({...f,owner:v}))} theme={t}/>
      <Btn onClick={addRisk} theme={t}>Add Risk</Btn>
    </Modal>}

    {modal==="add-change"&&<Modal onClose={()=>setModal(null)} theme={t}>
      <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700}}>Log a Scope Change</h3>
      <Field label="What changed?" value={form.title||""} onChange={v=>setForm(f=>({...f,title:v}))} theme={t} placeholder="e.g. SSO requirement added"/>
      <Field label="Affected Scope" value={form.scope||""} onChange={v=>setForm(f=>({...f,scope:v}))} theme={t}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Schedule Impact" value={form.impact||""} onChange={v=>setForm(f=>({...f,impact:v}))} theme={t} placeholder="+3d or -2d" hint="Positive = days added, negative = days saved. This feeds directly into buffer consumption."/>
        <Field label="Date" value={form.date||""} onChange={v=>setForm(f=>({...f,date:v}))} theme={t} placeholder="May 17"/>
      </div>
      <div style={{fontSize:11,color:t.textMuted,margin:"-4px 0 8px",lineHeight:1.5}}>Starts as <strong>pending</strong>. Tap the pill in the log to approve or reject. Only approved changes affect the buffer.</div>
      <Btn onClick={addChange} theme={t}>Log Change</Btn>
    </Modal>}

    <p style={{maxWidth:860,margin:"20px auto 0",fontSize:9,color:t.textFaint,textAlign:"center",lineHeight:1.6}}>
      Click title for project settings & buffer · ✎ to edit scopes · Tap pills to cycle status · Buffer = scope changes (auto) + slippage (manual)
    </p>
  </div>;
}
