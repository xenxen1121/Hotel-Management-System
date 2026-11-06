// APP: login, role-based shell, global event listeners (useEffect), refs, custom hook
import {useState,useEffect,useRef,useCallback} from 'react';
import {useStore,notify} from './store.jsx';
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
 return <div id="toasts">{list.map(t=><div key={t.id} className={'toast '+(t.type==='err'?'err':'')} onClick={()=>setList(l=>l.filter(x=>x.id!==t.id))}>{t.msg}</div>)}</div>;
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
 const submit=e=>{e.preventDefault(); // stop page reload
  if(mode==='login'){login(f.username.trim(),f.password)?notify('Welcome!'):setErr('Invalid username or password')}
  else{const r=register(f);if(r)setErr(r);else{notify('Account created. Please log in.');setMode('login');setErr('')}}};
 const demo=(u,p)=>setF(x=>({...x,username:u,password:p}));
 return <form className="login" onSubmit={submit}><h2>🏨 Hotel Management System</h2><p className="muted">{mode==='login'?'Sign in to continue':'Guest registration'}</p>
  {mode==='register'&&<><label>First name<input name="first" value={f.first} onChange={onChange} required/></label><label>Last name<input name="last" value={f.last} onChange={onChange} required/></label><label>Email<input type="email" name="email" value={f.email} onChange={onChange} required/></label></>}
  <label>Username<input ref={userRef} name="username" value={f.username} onChange={onChange} required/></label>
  <label>Password<input type="password" name="password" value={f.password} onChange={onChange} required minLength={4}/></label>
  {err&&<div style={{color:'#dc2626'}}>{err}</div>}
  <button type="submit">{mode==='login'?'Login':'Register'}</button>
  <button type="button" className="sec" onClick={()=>{setMode(mode==='login'?'register':'login');setErr('')}}>{mode==='login'?'New guest? Register':'Back to login'}</button>
  <div className="demo">Demo: <span onClick={()=>demo('admin','admin123')}>Admin</span><span onClick={()=>demo('reception','rec123')}>Receptionist</span><span onClick={()=>demo('guest','guest123')}>Guest</span><span onClick={()=>demo('house','house123')}>Housekeeping</span></div>
 </form>;
}

export default function App(){
 const {user,logout,reset}=useStore();
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
 return <><Toasts/>{!user?<Login/>:
  <div className="shell"><aside><h3>🏨 HMS</h3>
   {items.map((p,i)=><button key={p} className={p===current?'on':''} onClick={()=>go(p)} title={`Alt+${i+1}`}>{p}</button>)}
   <div style={{flex:1}}/>
   {user.role==='admin'&&<button onClick={()=>confirm('Reset all data to demo seed?')&&reset()}>Reset demo data</button>}
   <button onClick={logout}>Logout (Alt+L)</button></aside>
   <main ref={mainRef}><div className="top"><h2>{current}</h2><span className="muted">{user.username} ({user.role}) • {now.toLocaleTimeString()} • {online?'🟢 online':'🔴 offline'}</span></div>
    {PAGES[current]}</main></div>}</>;
}
