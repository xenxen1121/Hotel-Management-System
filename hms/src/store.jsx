// STORE: global state fetched from the MySQL-backed API (no more localStorage data). Business rules are enforced by the server.
import {createContext,useContext,useState,useEffect,useCallback} from 'react';
const TOKEN='hms-token'; // login token only (sessionStorage), NOT app data
const pad=n=>String(n).padStart(2,'0');
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}; // local date, same as the server
export const addDays=(d,n)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
export const nights=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
// Custom DOM event: any component can fire a toast, <Toasts/> listens for it
export const notify=(msg,type='ok')=>window.dispatchEvent(new CustomEvent('hms:toast',{detail:{msg,type}}));
const EMPTY={roomTypes:[],rooms:[],services:[],busy:[],guests:[],reservations:[],payments:[],resServices:[],housekeeping:[],users:[]};
const CLOSED=['Cancelled','No-show','Checked-out'];
const PATH={rooms:'/rooms',roomTypes:'/roomtypes',guests:'/guests',users:'/users'};

async function api(path,{method='GET',body}={}){
 const token=sessionStorage.getItem(TOKEN);let res;
 try{res=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)})}
 catch{throw Object.assign(new Error('Cannot reach the server. Is the backend running?'),{status:0})}
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Object.assign(new Error(data.error||`Request failed (${res.status})`),{status:res.status});
 return data;
}

const Ctx=createContext();export const useStore=()=>useContext(Ctx);
export function Provider({children}){
 const [s,setS]=useState(EMPTY);
 const [user,setUser]=useState(null);
 const [loading,setLoading]=useState(!!sessionStorage.getItem(TOKEN)); // restoring a previous session
 const clear=useCallback(()=>{sessionStorage.removeItem(TOKEN);setUser(null);setS(EMPTY)},[]);
 const refresh=useCallback(async()=>{const {me,...rest}=await api('/state');setUser(me);setS({...EMPTY,...rest})},[]);
 useEffect(()=>{if(sessionStorage.getItem(TOKEN))refresh().catch(clear).finally(()=>setLoading(false))},[refresh,clear]);
 useEffect(()=>{ // polling: keep data in sync with other users every 15s
  if(!user)return;const t=setInterval(()=>refresh().catch(e=>e.status===401&&clear()),15000);return()=>clearInterval(t)},[user?.id,refresh,clear]);
 // Every action returns an error string (or null on success), same convention as before
 const act=async(path,method='POST',body)=>{
  try{await api(path,{method,body})}catch(e){if(e.status===401)clear();return e.message}
  await refresh().catch(()=>{});return null};
 const login=async(u,p)=>{try{const d=await api('/auth/login',{method:'POST',body:{username:u,password:p}});sessionStorage.setItem(TOKEN,d.token);await refresh();return null}catch(e){return e.message}};
 const register=async f=>{try{await api('/auth/register',{method:'POST',body:f});return null}catch(e){return e.message}};
 const add=(t,item)=>act(PATH[t],'POST',item),upd=(t,id,patch)=>act(`${PATH[t]}/${id}`,'PUT',patch),del=(t,id)=>act(`${PATH[t]}/${id}`,'DELETE');
 const typeOf=r=>s.roomTypes.find(t=>t.id===r?.typeId)||{};
 // Availability preview (the server re-checks on booking): existing.ci < new.co AND existing.co > new.ci
 const overlap=(roomId,ci,co)=>s.busy.some(r=>r.roomId===roomId&&r.ci<co&&r.co>ci);
 const freeRooms=(ci,co,pax)=>co<=ci?[]:s.rooms.filter(r=>r.status!=='Maintenance'&&typeOf(r).cap>=+pax&&!overlap(r.id,ci,co));
 const bill=r=>{const svc=s.resServices.filter(x=>x.resId===r.id).reduce((a,x)=>a+x.subtotal,0),total=r.total+svc;
  const paid=s.payments.filter(p=>p.resId===r.id&&p.status==='Completed').reduce((a,p)=>a+p.amount,0);
  const refunded=s.payments.some(p=>p.resId===r.id&&p.status==='Refunded');
  return {svc,total,paid,balance:r.status==='Cancelled'?0:total-paid,payStatus:refunded?'Refunded':paid<=0?'Unpaid':paid>=total?'Paid':'Partial'}};
 const book=f=>act('/reservations','POST',{guestId:f.guestId,roomId:f.roomId,ci:f.ci,co:f.co,pax:f.pax});
 const pay=(r,amount,method)=>act(`/reservations/${r.id}/pay`,'POST',{amount,method});
 const checkIn=r=>act(`/reservations/${r.id}/checkin`),checkOut=r=>act(`/reservations/${r.id}/checkout`),cancel=r=>act(`/reservations/${r.id}/cancel`);
 const addService=(r,sid,qty)=>act(`/reservations/${r.id}/services`,'POST',{serviceId:sid,qty});
 const hk={clean:id=>act(`/housekeeping/${id}/clean`),release:id=>act(`/housekeeping/${id}/release`),damage:roomId=>act(`/rooms/${roomId}/damage`),repaired:roomId=>act(`/rooms/${roomId}/repaired`)};
 const reset=async()=>{const e=await act('/reset');e?notify(e,'err'):notify('Demo data restored')};
 return <Ctx.Provider value={{s,user,loading,login,logout:clear,register,add,upd,del,typeOf,freeRooms,bill,book,pay,checkIn,checkOut,cancel,addService,hk,reset}}>{children}</Ctx.Provider>;
}
