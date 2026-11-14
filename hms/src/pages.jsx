// PAGES: controlled forms, onChange/onSubmit/onClick/onKeyDown/onBlur, useMemo, debounce, conditional rendering, lists
import {useState,useEffect,useMemo} from 'react';
import {Icon,Empty} from './ui.jsx';
import {useStore,today,addDays,nights,notify} from './store.jsx';
const money=n=>'₱'+Number(n).toLocaleString();
const Badge=({v})=><span className={'badge '+String(v).toLowerCase().replace(/[^a-z]/g,'')}>{v}</span>;
const run=async(p,ok)=>{const err=await p;err?notify(err,'err'):notify(ok);return err}; // awaits the API call, shows a toast, returns the error (or null)
function useDebounce(v,ms=300){const [x,setX]=useState(v);useEffect(()=>{const t=setTimeout(()=>setX(v),ms);return()=>clearTimeout(t)},[v,ms]);return x}
function Table({head,rows}){return <div className="scroll"><table><thead><tr>{head.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
 {rows.length?rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>):<tr><td colSpan={head.length}><Empty text="No records yet"/></td></tr>}</tbody></table></div>}
const csv=(head,rows,name)=>{const t=[head,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download=name+'.csv';a.click()};
const gname=(s,id)=>{const g=s.guests.find(x=>x.id===id);return g?`${g.first} ${g.last}`:'?'};

export function Dashboard(){
 const {s,bill}=useStore();const t=today();
 const reserved=new Set(s.reservations.filter(r=>r.status==='Confirmed'&&r.ci>=t).map(r=>r.roomId)).size;
 const revenue=s.payments.filter(p=>p.status==='Completed').reduce((a,p)=>a+p.amount,0);
 const pending=s.reservations.filter(r=>r.status!=='Cancelled').reduce((a,r)=>a+bill(r).balance,0);
 const cnt=st=>s.rooms.filter(r=>r.status===st).length;
 const c=[['Total Rooms',s.rooms.length,'rooms',''],['Available',cnt('Available'),'clean','ok'],['Occupied',cnt('Occupied'),'hotel','info'],['Reserved',reserved,'calendar','gold'],
  ['Total Guests',s.guests.length,'guests',''],['Reservations',s.reservations.length,'calendar','gold'],['Revenue',money(revenue),'money','ok'],['Pending Payments',money(pending),'card','bad']];
 const mix=[['Available','var(--ok)'],['Occupied','var(--info)'],['Cleaning','var(--warn)'],['Maintenance','var(--bad)']];
 const arrivals=s.reservations.filter(r=>r.status==='Confirmed'&&r.ci===t),departures=s.reservations.filter(r=>r.status==='Checked-in'&&r.co<=t);
 const num=id=>s.rooms.find(r=>r.id===id)?.number;
 const List=({rows,empty})=>rows.length?<ul className="list">{rows.map(r=><li key={r.id}><span><b>{gname(s,r.guestId)}</b><br/><span className="muted">Room {num(r.roomId)}</span></span><Badge v={r.status}/></li>)}</ul>:<Empty icon="☕" text={empty}/>;
 return <><div className="grid">{c.map(([k,v,ic,tone])=><div key={k} className="card stat"><span className={'ic '+tone}><Icon n={ic}/></span><div><span className="muted">{k}</span><b>{v}</b></div></div>)}</div>
  <div className="card"><h3>Room status</h3><div className="bar" role="img" aria-label="Room status mix">{mix.map(([k,col])=><i key={k} title={k} style={{width:(s.rooms.length?cnt(k)/s.rooms.length*100:0)+'%',background:col}}/>)}</div>
   <div className="legend">{mix.map(([k,col])=><span key={k} style={{'--c':col}}>{k} · {cnt(k)}</span>)}</div></div>
  <div className="two"><div className="card"><h3>Arriving today</h3><List rows={arrivals} empty="No arrivals today"/></div><div className="card"><h3>Departing today</h3><List rows={departures} empty="No departures today"/></div></div></>;
}

export function Rooms(){
 const {s,user,add,upd,del,typeOf}=useStore();const admin=user.role==='admin';const staff=user.role!=='guest';
 const blank={number:'',typeId:1,status:'Available',amenities:'WiFi, AC, TV'};
 const [f,setF]=useState(blank);const [edit,setEdit]=useState(null);
 const onChange=e=>setF({...f,[e.target.name]:e.target.name==='typeId'?+e.target.value:e.target.value});
 const submit=async e=>{e.preventDefault();
  if(s.rooms.some(r=>r.number===f.number&&r.id!==edit))return notify('Room number exists','err');
  const err=await run(edit?upd('rooms',edit,f):add('rooms',f),edit?'Room updated':'Room added');if(!err){setF(blank);setEdit(null)}};
 return <>
  <div className="grid">{s.roomTypes.map(t=><div className="card roomtype" key={t.id}><h3>{t.name}{!admin&&<span className="price">{money(t.price)}<small> / night</small></span>}</h3><p className="muted">{t.desc}</p><p><span className="chip">Up to {t.cap} guests</span></p>
   {admin?<label>Price / night<input type="number" defaultValue={t.price} onBlur={e=>run(upd('roomTypes',t.id,{price:+e.target.value}),'Price updated')}/></label>:null}</div>)}</div>
  {admin&&<form className="card form row" onSubmit={submit}><label>Room no.<input name="number" value={f.number} onChange={onChange} required/></label>
   <label>Type<select name="typeId" value={f.typeId} onChange={onChange}>{s.roomTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   <label>Status<select name="status" value={f.status} onChange={onChange}>{['Available','Cleaning','Maintenance'].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Amenities<input name="amenities" value={f.amenities} onChange={onChange}/></label>
   <button>{edit?'Save':'Add Room'}</button>{edit&&<button type="button" className="sec" onClick={()=>{setEdit(null);setF(blank)}}>Cancel</button>}</form>}
  <div className="card"><Table head={['Room','Type','Price','Capacity','Status','Amenities',...(admin?['Actions']:[])]} rows={s.rooms.map(r=>[r.number,typeOf(r).name,money(typeOf(r).price),typeOf(r).cap,<Badge v={r.status}/>,r.amenities,
   ...(admin?[<div className="acts"><button className="sec" onClick={()=>{setEdit(r.id);setF({number:r.number,typeId:r.typeId,status:r.status==='Occupied'?'Available':r.status,amenities:r.amenities})}}>Edit</button>
   <button className="red" onClick={()=>s.reservations.some(x=>x.roomId===r.id&&!['Cancelled','Checked-out'].includes(x.status))?notify('Room has active reservations','err'):window.confirm('Delete room?')&&run(del('rooms',r.id),'Room deleted')}>Delete</button></div>]:[])])}/></div>
  {!staff&&<p className="muted">Go to “My Reservations” to book a room.</p>}</>;
}

export function Guests(){
 const {s,add,upd,del}=useStore();
 const blank={first:'',last:'',email:'',contact:'',address:'',idDetails:''};
 const [f,setF]=useState(blank);const [edit,setEdit]=useState(null);const [q,setQ]=useState('');const dq=useDebounce(q).toLowerCase();
 const onChange=e=>setF({...f,[e.target.name]:e.target.value});
 const submit=async e=>{e.preventDefault();if(!/^\S+@\S+\.\S+$/.test(f.email))return notify('Invalid email','err');
  const err=await run(edit?upd('guests',edit,f):add('guests',f),'Guest saved');if(!err){setF(blank);setEdit(null)}};
 const list=useMemo(()=>s.guests.filter(g=>JSON.stringify(g).toLowerCase().includes(dq)),[s.guests,dq]);
 return <><form className="card form row" onSubmit={submit}>
  {Object.keys(blank).map(k=><label key={k}>{k==='idDetails'?'ID details':k}<input name={k} value={f[k]} onChange={onChange} required={['first','last','email'].includes(k)}/></label>)}
  <button>{edit?'Save':'Register Guest'}</button>{edit&&<button type="button" className="sec" onClick={()=>{setEdit(null);setF(blank)}}>Cancel</button>}</form>
  <div className="card"><div className="toolbar"><input placeholder="Search guests…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Escape'&&setQ('')}/></div>
  <Table head={['ID','Name','Email','Contact','Address','ID','Actions']} rows={list.map(g=>[g.id,`${g.first} ${g.last}`,g.email,g.contact,g.address,g.idDetails,
   <div className="acts"><button className="sec" onClick={()=>{setEdit(g.id);setF(g)}}>Edit</button>
   <button className="red" onClick={()=>s.reservations.some(r=>r.guestId===g.id)?notify('Guest has reservations','err'):run(del('guests',g.id),'Guest deleted')}>Delete</button></div>])}/></div></>;
}

function Row({r}){
 const {s,user,bill,pay,checkIn,checkOut,cancel,addService,typeOf}=useStore();
 const [amt,setAmt]=useState('');const [method,setMethod]=useState('Cash');const [sv,setSv]=useState('');
 const b=bill(r),staff=user.role!=='guest',room=s.rooms.find(x=>x.id===r.roomId),open=!['Cancelled','Checked-out'].includes(r.status);
 const doPay=()=>{run(pay(r,amt,method),'Payment recorded');setAmt('')};
 return <tr><td>#{r.id}</td><td>{gname(s,r.guestId)}</td><td>{room?.number} ({typeOf(room).name})</td><td>{r.ci} → {r.co}<br/><span className="muted">{nights(r.ci,r.co)} night(s)</span></td>
  <td><Badge v={r.status}/></td><td>{money(b.total)}<br/><span className="muted">paid {money(b.paid)}</span></td><td><Badge v={b.payStatus}/></td>
  <td><div className="acts">
   {open&&b.balance>0&&<><input type="number" placeholder="Amount" value={amt} onChange={e=>setAmt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doPay()}/>
    <select value={method} onChange={e=>setMethod(e.target.value)}>{['Cash','Card','GCash','Bank'].map(m=><option key={m}>{m}</option>)}</select><button className="grn" onClick={doPay}>Pay</button></>}
   {staff&&r.status==='Checked-in'&&<><select value={sv} onChange={e=>setSv(e.target.value)}><option value="">Service…</option>{s.services.map(x=><option key={x.id} value={x.id}>{x.name} {money(x.price)}</option>)}</select>
    <button className="sec" onClick={()=>{run(addService(r,sv,1),'Service charged');setSv('')}}>Add</button></>}
   {staff&&r.status==='Confirmed'&&<button onClick={()=>run(checkIn(r),'Checked in')}>Check-in</button>}
   {staff&&r.status==='Checked-in'&&<button onClick={()=>run(checkOut(r),'Checked out — housekeeping notified')}>Check-out</button>}
   {open&&r.status!=='Checked-in'&&<button className="red" onClick={()=>window.confirm('Cancel reservation?')&&run(cancel(r),'Reservation cancelled')}>Cancel</button>}</div></td></tr>;
}

export function Reservations(){
 const {s,user,book,freeRooms,typeOf}=useStore();const staff=user.role!=='guest';
 const [f,setF]=useState({guestId:staff?'':user.guestId,ci:today(),co:addDays(today(),1),pax:1,roomId:''});
 const [q,setQ]=useState('');const [st,setSt]=useState('All');
 const onChange=e=>{const{name,value}=e.target;setF(p=>({...p,[name]:value,...(name!=='roomId'?{roomId:''}:{})}))};
 const free=useMemo(()=>freeRooms(f.ci,f.co,f.pax),[s.busy,s.rooms,s.roomTypes,f.ci,f.co,f.pax]);
 const submit=async e=>{e.preventDefault();const err=await run(book(f),'Reservation created (Pending). Pay a 30% deposit to confirm.');if(!err)setF(p=>({...p,roomId:''}))};
 const rows=s.reservations.filter(r=>(staff||r.guestId===user.guestId)&&(st==='All'||r.status===st)&&(`${gname(s,r.guestId)} #${r.id}`.toLowerCase().includes(q.toLowerCase()))).reverse();
 return <><form className="card form row" onSubmit={submit}><h3 style={{width:'100%',margin:0}}>New reservation</h3>
  {staff&&<label>Guest<select name="guestId" value={f.guestId} onChange={onChange}><option value="">Select…</option>{s.guests.map(g=><option key={g.id} value={g.id}>{g.first} {g.last}</option>)}</select></label>}
  <label>Check-in<input type="date" name="ci" min={today()} value={f.ci} onChange={onChange}/></label>
  <label>Check-out<input type="date" name="co" min={f.ci} value={f.co} onChange={onChange}/></label>
  <label>Guests<input type="number" name="pax" min="1" max="6" value={f.pax} onChange={onChange}/></label>
  <label>Available rooms ({free.length})<select name="roomId" value={f.roomId} onChange={onChange}><option value="">Select…</option>{free.map(r=><option key={r.id} value={r.id}>{r.number} – {typeOf(r).name} {money(typeOf(r).price)}</option>)}</select></label>
  <button>Reserve</button></form>
  <div className="card"><div className="toolbar"><input placeholder="Search guest or reservation #…" value={q} onChange={e=>setQ(e.target.value)}/>
   <select value={st} onChange={e=>setSt(e.target.value)}>{['All','Pending','Confirmed','Checked-in','Checked-out','Cancelled'].map(x=><option key={x}>{x}</option>)}</select></div>
  <div className="scroll"><table><thead><tr>{['ID','Guest','Room','Stay','Status','Amount','Payment','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
   <tbody>{rows.length?rows.map(r=><Row key={r.id} r={r}/>):<tr><td colSpan="8"><Empty icon="📅" text="No reservations found"/></td></tr>}</tbody></table></div></div></>;
}

export function Payments(){
 const {s}=useStore();
 return <div className="card"><Table head={['ID','Reservation','Guest','Amount','Method','Date','Reference','Status']} rows={[...s.payments].reverse().map(p=>{const r=s.reservations.find(x=>x.id===p.resId);
  return [p.id,'#'+p.resId,r?gname(s,r.guestId):'?',money(p.amount),p.method,p.date,p.ref,<Badge v={p.status}/>]})}/></div>;
}

export function Housekeeping(){
 const {s,hk}=useStore();
 const tasks=s.housekeeping.filter(h=>h.status!=='Inspected').reverse();
 const num=id=>s.rooms.find(r=>r.id===id)?.number;
 return <><div className="card"><h3>Rooms requiring cleaning</h3><Table head={['Room','Since','Status','Actions']} rows={tasks.map(h=>[num(h.roomId),h.date,<Badge v={h.status}/>,
  <div className="acts"><button disabled={h.status!=='Cleaning'} onClick={()=>run(hk.clean(h.id),'Marked cleaned')}>Mark Cleaned</button>
  <button className="grn" disabled={h.status!=='Cleaned'} onClick={()=>run(hk.release(h.id),'Inspected — room Available')}>Inspect &amp; Release</button></div>])}/></div>
  <div className="card"><h3>Room status</h3><Table head={['Room','Status','Actions']} rows={s.rooms.map(r=>[r.number,<Badge v={r.status}/>,
   r.status==='Maintenance'?<button onClick={()=>run(hk.repaired(r.id),'Sent back to cleaning')}>Repair done</button>:
   r.status==='Occupied'?<span className="muted">In use</span>:<button className="red" onClick={async()=>{const e=await hk.damage(r.id);e?notify(e,'err'):notify('Damage reported','err')}}>Report damage</button>])}/></div></>;
}

export function Reports(){
 const {s,bill,typeOf}=useStore();const [tab,setTab]=useState('Reservations');
 const R=s.reservations,rn=id=>s.rooms.find(r=>r.id===id)?.number;
 const T={
  Reservations:[['ID','Guest','Room','Check-in','Check-out','Status','Created'],R.map(r=>[r.id,gname(s,r.guestId),rn(r.roomId),r.ci,r.co,r.status,r.created])],
  Guests:[['ID','Name','Email','Contact'],s.guests.map(g=>[g.id,`${g.first} ${g.last}`,g.email,g.contact])],
  Occupancy:[['Room','Type','Status'],s.rooms.map(r=>[r.number,typeOf(r).name,r.status])],
  Payments:[['ID','Reservation','Amount','Method','Date','Status'],s.payments.map(p=>[p.id,p.resId,p.amount,p.method,p.date,p.status])],
  Revenue:[['Month','Revenue'],Object.entries(s.payments.filter(p=>p.status==='Completed').reduce((a,p)=>({...a,[p.date.slice(0,7)]:(a[p.date.slice(0,7)]||0)+p.amount}),{})).map(([m,v])=>[m,v])],
  Cancelled:[['ID','Guest','Room','Dates'],R.filter(r=>r.status==='Cancelled').map(r=>[r.id,gname(s,r.guestId),rn(r.roomId),`${r.ci} → ${r.co}`])]};
 const [head,rows]=T[tab];
 return <div className="card"><div className="acts" style={{marginBottom:10}}>{Object.keys(T).map(k=><button key={k} className={k===tab?'':'sec'} onClick={()=>setTab(k)}>{k}</button>)}
  <button className="grn" onClick={()=>csv(head,rows,tab)}>Export CSV</button></div><Table head={head} rows={rows}/></div>;
}

export function Users(){
 const {s,add,del,user}=useStore();const [f,setF]=useState({username:'',password:'',role:'receptionist'});
 const submit=async e=>{e.preventDefault();if(s.users.some(u=>u.username===f.username))return notify('Username taken','err');const err=await run(add('users',f),'Account created');if(!err)setF({username:'',password:'',role:'receptionist'})};
 return <><form className="card form row" onSubmit={submit}><label>Username<input value={f.username} onChange={e=>setF({...f,username:e.target.value})} required/></label>
  <label>Password<input value={f.password} onChange={e=>setF({...f,password:e.target.value})} required minLength={4}/></label>
  <label>Role<select value={f.role} onChange={e=>setF({...f,role:e.target.value})}>{['admin','receptionist','housekeeping'].map(r=><option key={r}>{r}</option>)}</select></label><button>Add Staff</button></form>
  <div className="card"><Table head={['ID','Username','Role','Actions']} rows={s.users.map(u=>[u.id,u.username,u.role,u.id===user.id?<span className="muted">You</span>:<button className="red" onClick={()=>window.confirm('Delete this account?')&&run(del('users',u.id),'Account deleted')}>Delete</button>])}/></div></>;
}
