// UI helpers: small inline-SVG icon set (no extra dependencies)
const P={
 dashboard:'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
 rooms:'M3 18v-8a2 2 0 012-2h14a2 2 0 012 2v8M3 14h18M3 18v2M21 18v2M7 8V6h4v2',
 guests:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
 calendar:'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
 card:'M2 6h20v12H2zM2 10h20M6 15h4',
 clean:'M12 22a10 10 0 100-20 10 10 0 000 20zM8 12l3 3 5-6',
 chart:'M4 20V10M10 20V4M16 20v-8M22 20H2',
 shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
 logout:'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
 reset:'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5',
 money:'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
 clock:'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
 hotel:'M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01'};
export const Icon=({n,size=20})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n]||P.dashboard}/></svg>;
export const NAV_ICON={Dashboard:'dashboard',Rooms:'rooms','Browse Rooms':'rooms',Guests:'guests',Reservations:'calendar','My Reservations':'calendar',Payments:'card',Housekeeping:'clean','Cleaning Tasks':'clean',Reports:'chart',Users:'shield'};
export const Empty=({icon='🗂️',text})=><div className="empty"><span className="big">{icon}</span>{text}</div>;
