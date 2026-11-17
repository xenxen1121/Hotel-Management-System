# Hotel Management System
React + Vite frontend · Node.js/Express API · **MySQL** database.

## 1. Requirements
- Node 18+ (Node 20/22 recommended)
- MySQL 8 or MariaDB running locally. **XAMPP works**: open the XAMPP Control Panel and press *Start* on MySQL.

## 2. Setup (first time only)
1. Open `.env` and check the database login. The default is `root` with an empty password (XAMPP default).
   If your MySQL has a password, put it in `DB_PASSWORD=`.
2. Install packages:
```
npm install
```

## 3. Run
```
npm run dev
```
Open http://localhost:5173

On the first start the backend automatically creates the database `hotel_system`, all tables, and the demo data.
You do not need to import any SQL file. The data is now stored in MySQL (not in the browser).

Other commands: `npm run server` (API only, port 5000) · `npm run client` (frontend only) ·
`npm run build` then `npm start` (one server for everything at http://localhost:5000).

## Demo accounts
admin/admin123 · reception/rec123 · guest/guest123 · house/house123
(The admin sidebar button "Reset demo data" wipes the database back to this demo data.)

## Database tables
users, guests, room_types, rooms, services, reservations, payments, reservation_services, housekeeping

## API overview (all under /api, JWT in `Authorization: Bearer ...`)
| Endpoint | Roles |
|---|---|
| POST /auth/login, /auth/register | public |
| GET /state | any logged-in user (data is filtered by role) |
| POST /reservations | admin, receptionist, guest |
| POST /reservations/:id/pay, /cancel | admin, receptionist, guest (own only) |
| POST /reservations/:id/checkin, /checkout, /services | admin, receptionist |
| POST/PUT/DELETE /rooms, PUT /roomtypes/:id | admin |
| POST/PUT/DELETE /guests | admin, receptionist |
| POST/DELETE /users, POST /reset | admin |
| POST /housekeeping/:id/clean, /release · POST /rooms/:id/damage, /repaired | admin, housekeeping |

Business rules (no double booking, date validation, 30% deposit confirms, balance must be 0 before check-out)
are enforced on the server in `server/index.js`. Passwords are hashed with bcrypt.

## Troubleshooting
- "Cannot connect to MySQL": MySQL is not started, or `DB_USER` / `DB_PASSWORD` in `.env` is wrong.
- "Cannot reach the server" in the browser: the API is not running. Use `npm run dev`, not only `npm run client`.
