// DATABASE: MySQL connection pool, schema creation and demo seed data
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const {DB_HOST='localhost',DB_PORT='3306',DB_USER='root',DB_PASSWORD='',DB_NAME='hotel_db'}=process.env;
const conn={host:DB_HOST,port:+DB_PORT,user:DB_USER,password:DB_PASSWORD};

export let pool;

const SCHEMA=[
`CREATE TABLE IF NOT EXISTS guests(
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL, last_name VARCHAR(80) NOT NULL,
  email VARCHAR(150) NOT NULL, contact VARCHAR(50) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '', id_details VARCHAR(150) NOT NULL DEFAULT ''
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS users(
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','receptionist','guest','housekeeping') NOT NULL,
  guest_id INT NULL,
  FOREIGN KEY(guest_id) REFERENCES guests(id) ON DELETE CASCADE
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS room_types(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE, price DECIMAL(10,2) NOT NULL,
  capacity INT NOT NULL, description VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS rooms(
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(20) NOT NULL UNIQUE,
  type_id INT NOT NULL,
  status ENUM('Available','Occupied','Cleaning','Maintenance') NOT NULL DEFAULT 'Available',
  amenities VARCHAR(255) NOT NULL DEFAULT '',
  FOREIGN KEY(type_id) REFERENCES room_types(id)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS services(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL, price DECIMAL(10,2) NOT NULL
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS reservations(
  id INT AUTO_INCREMENT PRIMARY KEY,
  guest_id INT NOT NULL, room_id INT NOT NULL,
  check_in DATE NOT NULL, check_out DATE NOT NULL, pax INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_on DATE NOT NULL, actual_in DATETIME NULL,
  INDEX idx_room_dates(room_id,check_in,check_out),
  FOREIGN KEY(guest_id) REFERENCES guests(id),
  FOREIGN KEY(room_id) REFERENCES rooms(id)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS payments(
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL, amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(20) NOT NULL, pay_date DATE NOT NULL,
  ref VARCHAR(30) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Completed',
  FOREIGN KEY(reservation_id) REFERENCES reservations(id)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS reservation_services(
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL, service_id INT NOT NULL,
  qty INT NOT NULL, subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY(reservation_id) REFERENCES reservations(id),
  FOREIGN KEY(service_id) REFERENCES services(id)
) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS housekeeping(
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL, reservation_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Cleaning', task_date DATE NOT NULL,
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY(reservation_id) REFERENCES reservations(id) ON DELETE SET NULL
) ENGINE=InnoDB`];

const TABLES=['housekeeping','reservation_services','payments','reservations','services','rooms','room_types','users','guests'];

export async function seed(c){
  const hash=p=>bcrypt.hashSync(p,10);
  await c.query(`INSERT INTO guests(id,first_name,last_name,email,contact,address,id_details) VALUES(1,'Juan','Dela Cruz','juan@mail.com','0917 000 0001','Cebu City','Driver License')`);
  await c.query(`INSERT INTO users(id,username,password_hash,role,guest_id) VALUES ?`,[[
    [1,'admin',hash('admin123'),'admin',null],[2,'reception',hash('rec123'),'receptionist',null],
    [3,'guest',hash('guest123'),'guest',1],[4,'house',hash('house123'),'housekeeping',null]]]);
  await c.query(`INSERT INTO room_types(id,name,price,capacity,description) VALUES ?`,[[
    [1,'Standard',1500,2,'Cozy room with queen bed'],[2,'Deluxe',2500,3,'Spacious room with sea view'],[3,'Suite',4500,4,'Luxury suite with lounge']]]);
  await c.query(`INSERT INTO rooms(room_number,type_id,status,amenities) VALUES ?`,[[
    ['101',1,'Available','WiFi, AC, TV'],['102',1,'Available','WiFi, AC, TV'],['201',2,'Available','WiFi, AC, TV'],
    ['202',2,'Available','WiFi, AC, TV'],['301',3,'Available','WiFi, AC, TV']]]);
  await c.query(`INSERT INTO services(name,price) VALUES ?`,[[['Food & Beverage',350],['Laundry',200],['Room Service',250],['Extra Bed',500]]]);
}

// Wipe everything and insert the demo data again
export async function resetData(){
  const c=await pool.getConnection();
  try{
    await c.query('SET FOREIGN_KEY_CHECKS=0');
    for(const t of TABLES)await c.query(`TRUNCATE TABLE ${t}`);
    await c.query('SET FOREIGN_KEY_CHECKS=1');
    await seed(c);
  }finally{c.release()}
}

export async function initDb(){
  let boot;
  try{boot=await mysql.createConnection(conn)}
  catch(e){
    console.error(`\n[db] Cannot connect to MySQL at ${DB_HOST}:${DB_PORT} as "${DB_USER}": ${e.message}`);
    console.error('[db] Start MySQL (e.g. XAMPP -> MySQL "Start") and check DB_USER / DB_PASSWORD in the .env file.\n');
    process.exit(1);
  }
  await boot.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await boot.end();
  pool=mysql.createPool({...conn,database:DB_NAME,waitForConnections:true,connectionLimit:10,
    dateStrings:true,decimalNumbers:true,charset:'utf8mb4'});
  for(const q of SCHEMA)await pool.query(q);
  const [[{n}]]=await pool.query('SELECT COUNT(*) n FROM users');
  if(n===0){const c=await pool.getConnection();try{await seed(c);console.log('[db] Empty database -> demo data inserted')}finally{c.release()}}
  console.log(`[db] Connected to MySQL database "${DB_NAME}"`);
}

// Run fn inside a transaction on one connection
export async function tx(fn){
  const c=await pool.getConnection();
  try{await c.beginTransaction();const r=await fn(c);await c.commit();return r}
  catch(e){await c.rollback();throw e}
  finally{c.release()}
}
