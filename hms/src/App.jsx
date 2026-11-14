// APP: login, role-based shell, global event listeners (useEffect), refs, custom hook
import {useState,useEffect,useRef,useCallback} from 'react';
import {useStore,notify} from './store.jsx';
import {Icon,NAV_ICON} from './ui.jsx';
import {Dashboard,Rooms,Guests,Reservations,Payments,Housekeeping,Reports,Users} from './pages.jsx';

const NAV={
 admin:['Dashboard','Rooms','Guests','Reservations','Payments','Housekeeping','Reports','Users'],
 receptionist:['Dashboard','Reservations','Guests','Rooms','Payments'],
 guest:['Browse Rooms','My Reservations'],
 housekeeping:['Cleaning Tasks']};
const PAGES={Dashboard:<Dashboard/>,Rooms:<Rooms/>,'Browse Rooms':<Rooms/>,Guests:<Guests/>,Reservations:<Reservations/>,'My Reservations':<Reservations/>,Payments:<Payments/>,Housekeeping:<Housekeeping/>,'Cleaning Tasks':<Housekeeping/>,Reports:<Reports/>,Users:<Users/>};

function Toasts(){ // listens to the custom 'hms:toast' event
 const [list,setList]=useState([]);
 useEffect(()=>{
  const on=e=>{const id=Math.random();setList(l=>[...l,{id,...e.detail}]);setTimeout(()=>setList(l=>l.filter(t=>t.id!==id)),3500)};
  const esc=e=>e.key==='Escape'&&setList([]);
  window.addEventListener('hms:toast',on);window.addEventListener('keydown',esc);
  return()=>{window.removeEventListener('hms:toast',on);window.removeEventListener('keydown',esc)}; // cleanup
 },[]);
 return <div id="toasts" role="status" aria-live="polite">{list.map(t=><div key={t.id} className={'toast '+(t.type==='err'?'err':'')} onClick={()=>setList(l=>l.filter(x=>x.id!==t.id))}>{t.msg}</div>)}</div>;
}

function useOnline(){ // custom hook around window online/offline events
 const [on,setOn]=useState(navigator.onLine);
 useEffect(()=>{const a=()=>setOn(true),b=()=>setOn(false);window.addEventListener('online',a);window.addEventListener('offline',b);
  return()=>{window.removeEventListener('online',a);window.removeEventListener('offline',b)}},[]);
 return on;
}

function Login(){
 const {login,register}=useStore();
 const [mode,setMode]=useState('login');
 const [f,setF]=useState({username:'',password:'',first:'',last:'',email:''});
 const [err,setErr]=useState('');
 const userRef=useRef(null);
 useEffect(()=>{userRef.current?.focus()},[mode]);
 const onChange=e=>setF({...f,[e.target.name]:e.target.value});
 const submit=async e=>{e.preventDefault(); // stop page reload
  if(mode==='login'){const r=await login(f.username.trim(),f.password);r?setErr(r):notify('Welcome!')}
  else{const r=await register(f);if(r)setErr(r);else{notify('Account created. Please log in.');setMode('login');setErr('')}}};
 const demo=(u,p)=>setF(x=>({...x,username:u,password:p}));
 return <div className="auth">
  <section className="auth-hero">
   <div className="brand"><span className="logo"><Icon n="hotel"/></span><div>Hotel Management<small>Front desk suite</small></div></div>
   <div><h1>Every guest, room and stay in one place.</h1><p>Reservations, check-in, billing and housekeeping, tied together in one simple workflow.</p>
    <ul><li>Double-booking protection</li><li>30% deposit confirmation</li><li>Live room &amp; housekeeping status</li></ul></div>
   <small style={{color:'#7fa6af',position:'relative',zIndex:1}}>Event-Driven Programming project</small>
  </section>
  <div className="auth-side"><form className="auth-card" onSubmit={submit}>
   <div><h2>{mode==='login'?'Welcome back':'Create guest account'}</h2><p className="muted" style={{margin:0}}>{mode==='login'?'Sign in to continue':'Register to book your stay'}</p></div>
   {mode==='register'&&<><label>First name<input name="first" value={f.first} onChange={onChange} required/></label><label>Last name<input name="last" value={f.last} onChange={onChange} required/></label><label>Email<input type="email" name="email" value={f.email} onChange={onChange} required/></label></>}
   <label>Username<input ref={userRef} name="username" value={f.username} onChange={onChange} autoComplete="username" required/></label>
   <label>Password<input type="password" name="password" value={f.password} onChange={onChange} autoComplete="current-password" required minLength={4}/></label>
   {err&&<div className="err-msg" role="alert">{err}</div>}
   <button type="submit">{mode==='login'?'Sign in':'Register'}</button>
   <button type="button" className="sec" onClick={()=>{setMode(mode==='login'?'register':'login');setErr('')}}>{mode==='login'?'New guest? Register':'Back to sign in'}</button>
   <div className="demo">Quick demo login<div><button type="button" onClick={()=>demo('admin','admin123')}>Admin</button><button type="button" onClick={()=>demo('reception','rec123')}>Receptionist</button><button type="button" onClick={()=>demo('guest','guest123')}>Guest</button><button type="button" onClick={()=>demo('house','house123')}>Housekeeping</button></div></div>
  </form></div></div>;
}

export default function App(){
 const {user,logout,reset,loading}=useStore();
 const [page,setPage]=useState(null);
 const [now,setNow]=useState(new Date());
 const online=useOnline();
 const mainRef=useRef(null);
 const items=user?NAV[user.role]:[];
 const current=page&&items.includes(page)?page:items[0];
 const go=useCallback(p=>{setPage(p);mainRef.current?.scrollTo(0,0)},[]);
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t)},[]); // live clock
 useEffect(()=>{ // keyboard shortcuts: Alt+1..9 navigate, Alt+L logout
  const k=e=>{if(!user||!e.altKey)return;const n=+e.key;if(n>=1&&n<=items.length){e.preventDefault();go(items[n-1])}if(e.key.toLowerCase()==='l')logout()};
  window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[user,items,go,logout]);
 const dateStr=now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 if(loading)return <Toasts/>; // restoring session from the server
 return <><Toasts/>{!user?<Login/>:
  <div className="shell"><aside>
   <div className="brand"><span className="logo"><Icon n="hotel"/></span><div>HMS<small>Hotel suite</small></div></div>
   <div className="nav-label">Menu</div>
   {items.map((p,i)=><button key={p} className={p===current?'on':''} aria-current={p===current?'page':undefined} onClick={()=>go(p)} title={`Alt+${i+1}`}><Icon n={NAV_ICON[p]}/>{p}</button>)}
   <div className="spacer" style={{flex:1}}/>
   {user.role==='admin'&&<button onClick={()=>confirm('Reset all data to demo seed?')&&reset()}><Icon n="reset"/>Reset demo data</button>}
   <button onClick={logout} title="Alt+L"><Icon n="logout"/>Logout</button>
   <div className="side-user"><span className="avatar">{user.username[0]}</span><div><b>{user.username}</b><span>{user.role}</span></div></div></aside>
   <main ref={mainRef}><div className="top"><div><h2>{current}</h2><p className="muted">{dateStr}</p></div>
    <div className="pills"><span className="pill"><Icon n="clock" size={14}/>{now.toLocaleTimeString()}</span><span className="pill"><i className={'dot '+(online?'':'off')}/>{online?'Online':'Offline'}</span></div></div>
    {PAGES[current]}</main></div>}</>;
}
