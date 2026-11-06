// STORE: global state (Context + useReducer), localStorage persistence (useEffect), business rules, custom events
import {createContext,useContext,useReducer,useEffect,useState} from 'react';
const KEY='hms-v1';
export const today=()=>new Date().toISOString().slice(0,10);
export const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
export const nights=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
// Custom DOM event: any component can fire a toast, <Toasts/> listens for it
export const notify=(msg,type='ok')=>window.dispatchEvent(new CustomEvent('hms:toast',{detail:{msg,type}}));
const seed={nid:100,
users:[{id:1,username:'admin',password:'admin123',role:'admin'},{id:2,username:'reception',password:'rec123',role:'receptionist'},{id:3,username:'guest',password:'guest123',role:'guest',guestId:1},{id:4,username:'house',password:'house123',role:'housekeeping'}],
guests:[{id:1,first:'Juan',last:'Dela Cruz',email:'juan@mail.com',contact:'0917 000 0001',address:'Cebu City',idDetails:'Driver License'}],
roomTypes:[{id:1,name:'Standard',price:1500,cap:2,desc:'Cozy room with queen bed'},{id:2,name:'Deluxe',price:2500,cap:3,desc:'Spacious room with sea view'},{id:3,name:'Suite',price:4500,cap:4,desc:'Luxury suite with lounge'}],
rooms:[101,102,201,202,301].map((n,i)=>({id:i+1,number:String(n),typeId:i<2?1:i<4?2:3,status:'Available',amenities:'WiFi, AC, TV'})),
services:[{id:1,name:'Food & Beverage',price:350},{id:2,name:'Laundry',price:200},{id:3,name:'Room Service',price:250},{id:4,name:'Extra Bed',price:500}],
reservations:[],payments:[],resServices:[],housekeeping:[]};
const reducer=(s,a)=>{switch(a.type){
 case 'add':return {...s,nid:s.nid+1,[a.t]:[...s[a.t],{...a.item,id:s.nid}]};
 case 'upd':return {...s,[a.t]:s[a.t].map(x=>x.id===a.id?{...x,...a.patch}:x)};
 case 'del':return {...s,[a.t]:s[a.t].filter(x=>x.id!==a.id)};
 case 'reset':return seed;default:return s}};
const Ctx=createContext();export const useStore=()=>useContext(Ctx);
const CLOSED=['Cancelled','No-show','Checked-out'];
export function Provider({children}){
 const [s,d]=useReducer(reducer,null,()=>{try{return JSON.parse(localStorage.getItem(KEY))||seed}catch{return seed}});
 const [user,setUser]=useState(null);
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(s))},[s]);
 const add=(t,item)=>d({type:'add',t,item}),upd=(t,id,patch)=>d({type:'upd',t,id,patch}),del=(t,id)=>d({type:'del',t,id});
 const typeOf=r=>s.roomTypes.find(t=>t.id===r?.typeId)||{};
 const login=(u,p)=>{const f=s.users.find(x=>x.username===u&&x.password===p);if(f)setUser(f);return !!f};
 const register=f=>{if(s.users.some(x=>x.username===f.username))return 'Username already taken';
  add('guests',{first:f.first,last:f.last,email:f.email,contact:'',address:'',idDetails:''});
  add('users',{username:f.username,password:f.password,role:'guest',guestId:s.nid});return null};
 // Double-booking rule: existing.ci < new.co AND existing.co > new.ci (closed reservations ignored)
 const overlap=(roomId,ci,co)=>s.reservations.some(r=>r.roomId===roomId&&!CLOSED.includes(r.status)&&r.ci<co&&r.co>ci);
 const freeRooms=(ci,co,pax)=>co<=ci?[]:s.rooms.filter(r=>r.status!=='Maintenance'&&typeOf(r).cap>=+pax&&!overlap(r.id,ci,co));
 const bill=r=>{const svc=s.resServices.filter(x=>x.resId===r.id).reduce((a,x)=>a+x.subtotal,0),total=r.total+svc;
  const paid=s.payments.filter(p=>p.resId===r.id&&p.status==='Completed').reduce((a,p)=>a+p.amount,0);
  const refunded=s.payments.some(p=>p.resId===r.id&&p.status==='Refunded');
  return {svc,total,paid,balance:r.status==='Cancelled'?0:total-paid,payStatus:refunded?'Refunded':paid<=0?'Unpaid':paid>=total?'Paid':'Partial'}};
 const book=({guestId,roomId,ci,co,pax})=>{
  if(!guestId)return 'Select a guest';if(!roomId)return 'Select an available room';
  if(ci<today())return 'Check-in cannot be in the past';if(co<=ci)return 'Check-out must be after check-in';
  const room=s.rooms.find(r=>r.id===+roomId),ty=typeOf(room);
  if(+pax>ty.cap)return `Room capacity is ${ty.cap}`;if(overlap(room.id,ci,co))return 'Room already booked for those dates';
  add('reservations',{guestId:+guestId,roomId:room.id,ci,co,pax:+pax,total:nights(ci,co)*ty.price,status:'Pending',created:today()});return null};
 const pay=(r,amount,method)=>{amount=+amount;const b=bill(r);
  if(CLOSED.includes(r.status)&&r.status!=='Checked-out')return 'Reservation is closed';
  if(!(amount>0))return 'Enter a valid amount';if(amount>b.balance)return 'Amount exceeds balance';
  add('payments',{resId:r.id,amount,method,date:today(),ref:'REF'+Date.now().toString().slice(-6),status:'Completed'});
  if(r.status==='Pending'&&b.paid+amount>=b.total*0.3)upd('reservations',r.id,{status:'Confirmed'}); // 30% deposit confirms
  return null};
 const checkIn=r=>{const room=s.rooms.find(x=>x.id===r.roomId);
  if(r.status!=='Confirmed')return 'Needs Confirmed status (pay 30% deposit)';if(r.ci>today())return 'Too early for check-in';
  if(room.status!=='Available')return `Room is ${room.status}`;
  upd('reservations',r.id,{status:'Checked-in',actualIn:new Date().toLocaleString()});upd('rooms',room.id,{status:'Occupied'});return null};
 const checkOut=r=>{if(r.status!=='Checked-in')return 'Guest is not checked in';if(bill(r).balance>0)return 'Collect remaining balance first';
  upd('reservations',r.id,{status:'Checked-out'});upd('rooms',r.roomId,{status:'Cleaning'});
  add('housekeeping',{roomId:r.roomId,resId:r.id,status:'Cleaning',date:today()});return null};
 const cancel=r=>{if(['Checked-in','Checked-out','Cancelled'].includes(r.status))return 'Cannot cancel this reservation';
  upd('reservations',r.id,{status:'Cancelled'});s.payments.filter(p=>p.resId===r.id).forEach(p=>upd('payments',p.id,{status:'Refunded'}));return null};
 const addService=(r,sid,qty)=>{const sv=s.services.find(x=>x.id===+sid);if(!sv)return 'Select a service';if(r.status!=='Checked-in')return 'Guest must be checked in';
  add('resServices',{resId:r.id,serviceId:sv.id,qty:+qty,subtotal:sv.price*qty});return null};
 return <Ctx.Provider value={{s,user,login,logout:()=>setUser(null),register,add,upd,del,typeOf,freeRooms,bill,book,pay,checkIn,checkOut,cancel,addService,reset:()=>d({type:'reset'})}}>{children}</Ctx.Provider>;
}
