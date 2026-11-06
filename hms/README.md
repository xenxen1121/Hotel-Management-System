# Hotel Management System (Event-Driven Programming)
React + Vite web app. Data is persisted in browser localStorage (no backend needed).

## Run
```
npm install
npm run dev      # open http://localhost:5173
```
## Demo accounts
admin/admin123 · reception/rec123 · guest/guest123 · house/house123

## Workflow implemented
Login → role dashboard → Guest registration → Reservation (availability + double-booking check) → Deposit/payment (30% confirms) →
Check-in (room Occupied) → Services → Check-out (balance must be 0, room → Cleaning) → Housekeeping (clean → inspect → Available) → Dashboard & Reports (CSV export).

## Event-driven programming concepts used
| Concept | Where |
|---|---|
| Components / JSX / props | every file; `Row`, `Table`, `Badge` |
| useState | forms, filters, edit mode, toasts (pages.jsx, App.jsx) |
| useEffect + cleanup | localStorage save, clock `setInterval`, window listeners |
| useRef | focus username field, scroll main to top (App.jsx) |
| useMemo / useCallback | available-room list, guest search, `go()` navigation |
| useReducer + Context | global store (store.jsx) |
| Custom hooks | `useOnline`, `useDebounce` |
| React events | onClick, onChange, onSubmit, onKeyDown (Enter to pay, Esc to clear), onBlur (price edit) |
| preventDefault | login/registration/reservation forms |
| Native DOM events | window `keydown` (Alt+1..9, Alt+L, Esc), `online`/`offline` |
| Custom events | `CustomEvent('hms:toast')` dispatched by `notify()`, handled by `<Toasts/>` |
| Controlled inputs, conditional rendering, lists + keys | all pages |
| Event-triggered business rules | overlap check, date validation, payment/check-in/out validation |
