// API SERVER: Express + MySQL. Auth (JWT + bcrypt), role checks and all business rules live here.
import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import {initDb,pool,tx,resetData} from './db.js';

const SECRET=process.env.JWT_SECRET||'dev-secret-change-me';
const PORT=+process.env.PORT||5000;
const CLOSED=['Cancelled','No-show','Checked-out'];
const app=express();
app.use(express.json());

class HttpError extends Error{constructor(status,msg){super(msg);this.status=status}}
const bad=msg=>new HttpError(400,msg);
const h=fn=>(req,res,next)=>fn(req,res,next).catch(next);
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const nowSql=()=>{const d=new Date();return `${today()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`};
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(new Date(s));
const nights=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const txt=(v,max=255)=>String(v??'').trim().slice(0,max);
const money=n=>Math.round(Number(n)*100)/100;

// ---------- row mappers (DB snake_case -> the camelCase shape the React app uses) ----------
const mUser=u=>({id:u.id,username:u.username,role:u.role,guestId:u.guest_id});
const mGuest=g=>({id:g.id,first:g.first_name,last:g.last_name,email:g.email,contact:g.contact,address:g.address,idDetails:g.id_details});
const mType=t=>({id:t.id,name:t.name,price:t.price,cap:t.capacity,desc:t.description});
const mRoom=r=>({id:r.id,number:r.room_number,typeId:r.type_id,status:r.status,amenities:r.amenities});
const mRes=r=>({id:r.id,guestId:r.guest_id,roomId:r.room_id,ci:r.check_in,co:r.check_out,pax:r.pax,total:r.total,status:r.status,created:r.created_on,actualIn:r.actual_in});
const mPay=p=>({id:p.id,resId:p.reservation_id,amount:p.amount,method:p.method,date:p.pay_date,ref:p.ref,status:p.status});
const mSvc=x=>({id:x.id,resId:x.reservation_id,serviceId:x.service_id,qty:x.qty,subtotal:x.subtotal});
const mHk=x=>({id:x.id,roomId:x.room_id,resId:x.reservation_id,status:x.status,date:x.task_date});

// ---------- auth ----------
const sign=u=>jwt.sign({id:u.id},SECRET,{expiresIn:'8h'});
const auth=h(async(req,res,next)=>{
  const t=(req.headers.authorization||'').replace(/^Bearer /,'');
  let id;try{id=jwt.verify(t,SECRET).id}catch{throw new HttpError(401,'Please sign in again')}
  const [[u]]=await pool.query('SELECT * FROM users WHERE id=?',[id]);
  if(!u)throw new HttpError(401,'Account no longer exists');
  req.user=mUser(u);next();
});
const roles=(...r)=>(req,res,next)=>r.includes(req.user.role)?next():next(new HttpError(403,'You are not allowed to do this'));
const STAFF=['admin','receptionist'];

app.post('/api/auth/login',h(async(req,res)=>{
  const [[u]]=await pool.query('SELECT * FROM users WHERE username=?',[txt(req.body.username,50)]);
  if(!u||!bcrypt.compareSync(String(req.body.password??''),u.password_hash))throw new HttpError(401,'Invalid username or password');
  res.json({token:sign(u),user:mUser(u)});
}));

app.post('/api/auth/register',h(async(req,res)=>{
  const f=req.body,username=txt(f.username,50),password=String(f.password??'');
  const first=txt(f.first,80),last=txt(f.last,80),email=txt(f.email,150);
  if(!username||!first||!last||!email)throw bad('Please fill in all fields');
  if(!/^\S+@\S+\.\S+$/.test(email))throw bad('Invalid email');
  if(password.length<4)throw bad('Password must be at least 4 characters');
  await tx(async c=>{
    const [[x]]=await c.query('SELECT id FROM users WHERE username=?',[username]);
    if(x)throw bad('Username already taken');
    const [g]=await c.query('INSERT INTO guests(first_name,last_name,email) VALUES(?,?,?)',[first,last,email]);
    await c.query('INSERT INTO users(username,password_hash,role,guest_id) VALUES(?,?,?,?)',[username,bcrypt.hashSync(password,10),'guest',g.insertId]);
  });
  res.status(201).json({ok:true});
}));

// ---------- state: everything the logged-in user is allowed to see ----------
app.get('/api/state',auth,h(async(req,res)=>{
  const u=req.user,q=async(sql,p=[])=>(await pool.query(sql,p))[0];
  const staff=STAFF.includes(u.role),out={me:u};
  out.roomTypes=(await q('SELECT * FROM room_types ORDER BY id')).map(mType);
  out.rooms=(await q('SELECT * FROM rooms ORDER BY id')).map(mRoom);
  out.services=(await q('SELECT * FROM services ORDER BY id')).map(x=>({id:x.id,name:x.name,price:x.price}));
  // only dates of open bookings (no personal data) so every role can see which rooms are free
  out.busy=(await q(`SELECT room_id,check_in,check_out FROM reservations WHERE status NOT IN (?)`,[CLOSED]))
    .map(r=>({roomId:r.room_id,ci:r.check_in,co:r.check_out}));
  if(staff){
    out.guests=(await q('SELECT * FROM guests ORDER BY id')).map(mGuest);
    out.reservations=(await q('SELECT * FROM reservations ORDER BY id')).map(mRes);
    out.payments=(await q('SELECT * FROM payments ORDER BY id')).map(mPay);
    out.resServices=(await q('SELECT * FROM reservation_services ORDER BY id')).map(mSvc);
  }else if(u.role==='guest'){
    out.guests=(await q('SELECT * FROM guests WHERE id=?',[u.guestId])).map(mGuest);
    out.reservations=(await q('SELECT * FROM reservations WHERE guest_id=? ORDER BY id',[u.guestId])).map(mRes);
    out.payments=(await q('SELECT p.* FROM payments p JOIN reservations r ON r.id=p.reservation_id WHERE r.guest_id=? ORDER BY p.id',[u.guestId])).map(mPay);
    out.resServices=(await q('SELECT s.* FROM reservation_services s JOIN reservations r ON r.id=s.reservation_id WHERE r.guest_id=? ORDER BY s.id',[u.guestId])).map(mSvc);
  }
  if(u.role==='admin'||u.role==='housekeeping')out.housekeeping=(await q('SELECT * FROM housekeeping ORDER BY id')).map(mHk);
  if(u.role==='admin')out.users=(await q('SELECT * FROM users ORDER BY id')).map(mUser);
  res.json(out);
}));

// ---------- room types / rooms (admin) ----------
app.put('/api/roomtypes/:id',auth,roles('admin'),h(async(req,res)=>{
  const [[t]]=await pool.query('SELECT * FROM room_types WHERE id=?',[req.params.id]);
  if(!t)throw new HttpError(404,'Room type not found');
  const b=req.body,price=b.price===undefined?t.price:money(b.price);
  if(!(price>=0))throw bad('Invalid price');
  await pool.query('UPDATE room_types SET name=?,price=?,capacity=?,description=? WHERE id=?',
    [txt(b.name??t.name,60),price,+b.cap||t.capacity,txt(b.desc??t.description),t.id]);
  res.json({ok:true});
}));

const ROOM_STATUS=['Available','Cleaning','Maintenance'];
async function roomBody(c,b,id){
  const number=txt(b.number,20);if(!number)throw bad('Room number is required');
  const [[t]]=await c.query('SELECT id FROM room_types WHERE id=?',[+b.typeId]);if(!t)throw bad('Select a room type');
  if(!ROOM_STATUS.includes(b.status))throw bad('Invalid status');
  const [[d]]=await c.query('SELECT id FROM rooms WHERE room_number=? AND id<>?',[number,id||0]);
  if(d)throw bad('Room number exists');
  return {number,typeId:t.id,status:b.status,amenities:txt(b.amenities)};
}
app.post('/api/rooms',auth,roles('admin'),h(async(req,res)=>{
  const r=await roomBody(pool,req.body);
  await pool.query('INSERT INTO rooms(room_number,type_id,status,amenities) VALUES(?,?,?,?)',[r.number,r.typeId,r.status,r.amenities]);
  res.status(201).json({ok:true});
}));
app.put('/api/rooms/:id',auth,roles('admin'),h(async(req,res)=>{
  const [[cur]]=await pool.query('SELECT * FROM rooms WHERE id=?',[req.params.id]);
  if(!cur)throw new HttpError(404,'Room not found');
  const r=await roomBody(pool,req.body,cur.id);
  const status=cur.status==='Occupied'?'Occupied':r.status; // a guest is inside: keep Occupied
  await pool.query('UPDATE rooms SET room_number=?,type_id=?,status=?,amenities=? WHERE id=?',[r.number,r.typeId,status,r.amenities,cur.id]);
  res.json({ok:true});
}));
app.delete('/api/rooms/:id',auth,roles('admin'),h(async(req,res)=>{
  const [[a]]=await pool.query('SELECT id FROM reservations WHERE room_id=? AND status NOT IN (?,?) LIMIT 1',[req.params.id,'Cancelled','Checked-out']);
  if(a)throw bad('Room has active reservations');
  await pool.query('DELETE FROM rooms WHERE id=?',[req.params.id]);
  res.json({ok:true});
}));

// ---------- guests ----------
function guestBody(b){
  const g={first:txt(b.first,80),last:txt(b.last,80),email:txt(b.email,150),contact:txt(b.contact,50),address:txt(b.address),idDetails:txt(b.idDetails,150)};
  if(!g.first||!g.last)throw bad('First and last name are required');
  if(!/^\S+@\S+\.\S+$/.test(g.email))throw bad('Invalid email');
  return g;
}
app.post('/api/guests',auth,roles(...STAFF),h(async(req,res)=>{
  const g=guestBody(req.body);
  await pool.query('INSERT INTO guests(first_name,last_name,email,contact,address,id_details) VALUES(?,?,?,?,?,?)',[g.first,g.last,g.email,g.contact,g.address,g.idDetails]);
  res.status(201).json({ok:true});
}));
app.put('/api/guests/:id',auth,roles(...STAFF),h(async(req,res)=>{
  const g=guestBody(req.body);
  const [r]=await pool.query('UPDATE guests SET first_name=?,last_name=?,email=?,contact=?,address=?,id_details=? WHERE id=?',[g.first,g.last,g.email,g.contact,g.address,g.idDetails,req.params.id]);
  if(!r.affectedRows)throw new HttpError(404,'Guest not found');
  res.json({ok:true});
}));
app.delete('/api/guests/:id',auth,roles(...STAFF),h(async(req,res)=>{
  const [[x]]=await pool.query('SELECT id FROM reservations WHERE guest_id=? LIMIT 1',[req.params.id]);
  if(x)throw bad('Guest has reservations');
  await pool.query('DELETE FROM guests WHERE id=?',[req.params.id]);
  res.json({ok:true});
}));

// ---------- staff accounts (admin) ----------
app.post('/api/users',auth,roles('admin'),h(async(req,res)=>{
  const username=txt(req.body.username,50),password=String(req.body.password??''),role=req.body.role;
  if(!username)throw bad('Username is required');
  if(password.length<4)throw bad('Password must be at least 4 characters');
  if(!['admin','receptionist','housekeeping'].includes(role))throw bad('Invalid role');
  const [[x]]=await pool.query('SELECT id FROM users WHERE username=?',[username]);
  if(x)throw bad('Username taken');
  await pool.query('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)',[username,bcrypt.hashSync(password,10),role]);
  res.status(201).json({ok:true});
}));
app.delete('/api/users/:id',auth,roles('admin'),h(async(req,res)=>{
  if(+req.params.id===req.user.id)throw bad('You cannot delete your own account');
  const [[u]]=await pool.query('SELECT * FROM users WHERE id=?',[req.params.id]);
  if(!u)throw new HttpError(404,'User not found');
  if(u.role==='admin'){const [[{n}]]=await pool.query("SELECT COUNT(*) n FROM users WHERE role='admin'");if(n<=1)throw bad('Cannot delete the last admin')}
  await pool.query('DELETE FROM users WHERE id=?',[u.id]);
  res.json({ok:true});
}));

// ---------- reservations ----------
const lock=async(c,id)=>{const [[r]]=await c.query('SELECT * FROM reservations WHERE id=? FOR UPDATE',[id]);if(!r)throw new HttpError(404,'Reservation not found');return r};
const own=(req,r)=>{if(req.user.role==='guest'&&r.guest_id!==req.user.guestId)throw new HttpError(403,'This is not your reservation')};
async function bill(c,r){
  const [[{svc}]]=await c.query('SELECT COALESCE(SUM(subtotal),0) svc FROM reservation_services WHERE reservation_id=?',[r.id]);
  const [[{paid}]]=await c.query("SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE reservation_id=? AND status='Completed'",[r.id]);
  const total=money(r.total+Number(svc)),p=Number(paid);
  return {total,paid:p,balance:r.status==='Cancelled'?0:money(total-p)};
}

app.post('/api/reservations',auth,roles('admin','receptionist','guest'),h(async(req,res)=>{
  const b=req.body,ci=String(b.ci||''),co=String(b.co||''),pax=+b.pax;
  const guestId=req.user.role==='guest'?req.user.guestId:+b.guestId;
  if(!guestId)throw bad('Select a guest');if(!b.roomId)throw bad('Select an available room');
  if(!isDate(ci)||!isDate(co))throw bad('Invalid dates');
  if(ci<today())throw bad('Check-in cannot be in the past');if(co<=ci)throw bad('Check-out must be after check-in');
  if(!(pax>=1))throw bad('Number of guests must be at least 1');
  await tx(async c=>{
    const [[g]]=await c.query('SELECT id FROM guests WHERE id=?',[guestId]);if(!g)throw bad('Select a guest');
    // lock the room row so two people cannot book the same room at the same moment
    const [[room]]=await c.query('SELECT r.*,t.price,t.capacity FROM rooms r JOIN room_types t ON t.id=r.type_id WHERE r.id=? FOR UPDATE',[+b.roomId]);
    if(!room)throw bad('Select an available room');
    if(room.status==='Maintenance')throw bad('Room is under maintenance');
    if(pax>room.capacity)throw bad(`Room capacity is ${room.capacity}`);
    const [[o]]=await c.query('SELECT id FROM reservations WHERE room_id=? AND status NOT IN (?) AND check_in<? AND check_out>? LIMIT 1',[room.id,CLOSED,co,ci]);
    if(o)throw bad('Room already booked for those dates');
    await c.query('INSERT INTO reservations(guest_id,room_id,check_in,check_out,pax,total,status,created_on) VALUES(?,?,?,?,?,?,?,?)',
      [guestId,room.id,ci,co,pax,nights(ci,co)*room.price,'Pending',today()]);
  });
  res.status(201).json({ok:true});
}));

app.post('/api/reservations/:id/pay',auth,roles('admin','receptionist','guest'),h(async(req,res)=>{
  const amount=money(req.body.amount),method=['Cash','Card','GCash','Bank'].includes(req.body.method)?req.body.method:'Cash';
  await tx(async c=>{
    const r=await lock(c,req.params.id);own(req,r);
    if(CLOSED.includes(r.status)&&r.status!=='Checked-out')throw bad('Reservation is closed');
    const b=await bill(c,r);
    if(!(amount>0))throw bad('Enter a valid amount');if(amount>b.balance)throw bad('Amount exceeds balance');
    await c.query('INSERT INTO payments(reservation_id,amount,method,pay_date,ref,status) VALUES(?,?,?,?,?,?)',
      [r.id,amount,method,today(),'REF'+Date.now().toString().slice(-6),'Completed']);
    if(r.status==='Pending'&&b.paid+amount>=b.total*0.3)await c.query("UPDATE reservations SET status='Confirmed' WHERE id=?",[r.id]); // 30% deposit confirms
  });
  res.json({ok:true});
}));

app.post('/api/reservations/:id/cancel',auth,roles('admin','receptionist','guest'),h(async(req,res)=>{
  await tx(async c=>{
    const r=await lock(c,req.params.id);own(req,r);
    if(['Checked-in','Checked-out','Cancelled'].includes(r.status))throw bad('Cannot cancel this reservation');
    await c.query("UPDATE reservations SET status='Cancelled' WHERE id=?",[r.id]);
    await c.query("UPDATE payments SET status='Refunded' WHERE reservation_id=?",[r.id]);
  });
  res.json({ok:true});
}));

app.post('/api/reservations/:id/checkin',auth,roles(...STAFF),h(async(req,res)=>{
  await tx(async c=>{
    const r=await lock(c,req.params.id);
    const [[room]]=await c.query('SELECT * FROM rooms WHERE id=? FOR UPDATE',[r.room_id]);
    if(r.status!=='Confirmed')throw bad('Needs Confirmed status (pay 30% deposit)');
    if(r.check_in>today())throw bad('Too early for check-in');
    if(room.status!=='Available')throw bad(`Room is ${room.status}`);
    await c.query("UPDATE reservations SET status='Checked-in',actual_in=? WHERE id=?",[nowSql(),r.id]);
    await c.query("UPDATE rooms SET status='Occupied' WHERE id=?",[room.id]);
  });
  res.json({ok:true});
}));

app.post('/api/reservations/:id/checkout',auth,roles(...STAFF),h(async(req,res)=>{
  await tx(async c=>{
    const r=await lock(c,req.params.id);
    if(r.status!=='Checked-in')throw bad('Guest is not checked in');
    if((await bill(c,r)).balance>0)throw bad('Collect remaining balance first');
    await c.query("UPDATE reservations SET status='Checked-out' WHERE id=?",[r.id]);
    await c.query("UPDATE rooms SET status='Cleaning' WHERE id=?",[r.room_id]);
    await c.query("INSERT INTO housekeeping(room_id,reservation_id,status,task_date) VALUES(?,?,'Cleaning',?)",[r.room_id,r.id,today()]);
  });
  res.json({ok:true});
}));

app.post('/api/reservations/:id/services',auth,roles(...STAFF),h(async(req,res)=>{
  const qty=Math.floor(+req.body.qty||1);
  await tx(async c=>{
    const r=await lock(c,req.params.id);
    const [[sv]]=await c.query('SELECT * FROM services WHERE id=?',[+req.body.serviceId]);
    if(!sv)throw bad('Select a service');
    if(r.status!=='Checked-in')throw bad('Guest must be checked in');
    if(qty<1)throw bad('Invalid quantity');
    await c.query('INSERT INTO reservation_services(reservation_id,service_id,qty,subtotal) VALUES(?,?,?,?)',[r.id,sv.id,qty,sv.price*qty]);
  });
  res.json({ok:true});
}));

// ---------- housekeeping ----------
const HK=['admin','housekeeping'];
app.post('/api/housekeeping/:id/clean',auth,roles(...HK),h(async(req,res)=>{
  const [r]=await pool.query("UPDATE housekeeping SET status='Cleaned' WHERE id=? AND status='Cleaning'",[req.params.id]);
  if(!r.affectedRows)throw bad('Task is not waiting to be cleaned');
  res.json({ok:true});
}));
app.post('/api/housekeeping/:id/release',auth,roles(...HK),h(async(req,res)=>{
  await tx(async c=>{
    const [[t]]=await c.query('SELECT * FROM housekeeping WHERE id=? FOR UPDATE',[req.params.id]);
    if(!t||t.status!=='Cleaned')throw bad('Room must be cleaned first');
    await c.query("UPDATE housekeeping SET status='Inspected' WHERE id=?",[t.id]);
    await c.query("UPDATE rooms SET status='Available' WHERE id=?",[t.room_id]);
  });
  res.json({ok:true});
}));
app.post('/api/rooms/:id/damage',auth,roles(...HK),h(async(req,res)=>{
  const [r]=await pool.query("UPDATE rooms SET status='Maintenance' WHERE id=? AND status<>'Occupied'",[req.params.id]);
  if(!r.affectedRows)throw bad('Room is in use or does not exist');
  res.json({ok:true});
}));
app.post('/api/rooms/:id/repaired',auth,roles(...HK),h(async(req,res)=>{
  await tx(async c=>{
    const [[room]]=await c.query('SELECT * FROM rooms WHERE id=? FOR UPDATE',[req.params.id]);
    if(!room||room.status!=='Maintenance')throw bad('Room is not under maintenance');
    await c.query("UPDATE rooms SET status='Cleaning' WHERE id=?",[room.id]);
    await c.query("INSERT INTO housekeeping(room_id,status,task_date) VALUES(?,'Cleaning',?)",[room.id,today()]);
  });
  res.json({ok:true});
}));

// ---------- demo reset (admin) ----------
app.post('/api/reset',auth,roles('admin'),h(async(req,res)=>{await resetData();res.json({ok:true})}));

app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));

// Serve the built frontend if `npm run build` was run (production style: one server for everything)
const dist=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
if(fs.existsSync(dist)){app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')))}

app.use((e,req,res,next)=>{
  if(e instanceof HttpError)return res.status(e.status).json({error:e.message});
  if(e.errno===1451)return res.status(409).json({error:'This record is used by other data and cannot be deleted'});
  if(e.errno===1062)return res.status(409).json({error:'That value already exists'});
  console.error(e);res.status(500).json({error:'Server error'});
});

await initDb();
app.listen(PORT,()=>console.log(`[api] Hotel API running on http://localhost:${PORT}`));
