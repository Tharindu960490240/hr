import { config } from '../config.js';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's date (YYYY-MM-DD) in the office timezone — NOT UTC, which is a day behind in Sydney mornings. */
export const todayISO = () => fmt.format(new Date());
export const thisYear = () => Number(todayISO().slice(0, 4));
