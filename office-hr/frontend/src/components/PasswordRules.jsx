import { CheckCircleRounded, RadioButtonUncheckedRounded } from '@mui/icons-material';
import '../styles/password.css';

// keep in sync with backend/src/routes/auth.js passwordSchema
export const RULES = [
  { id: 'len', label: '8 or more characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'A capital letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A small letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'num', label: 'A number (0–9)', test: (p) => /[0-9]/.test(p) },
  { id: 'sym', label: 'A symbol, e.g. @ $ ! % * ? &', test: (p) => /[^A-Za-z0-9]/.test(p) },
];
// display order matches the design: left column then right column
const ORDER = ['len', 'upper', 'lower', 'num', 'sym'];

export const passwordOk = (p) => RULES.every((r) => r.test(p));

export default function PasswordRules({ password = '' }) {
  const score = RULES.filter((r) => r.test(password)).length;
  return (
    <div className="pw-rules" aria-live="polite">
      <p className="pw-rules-title">Your password needs</p>
      <div className="pw-meter" data-score={password ? score : 0} aria-hidden="true">
        <span /><span /><span /><span /><span />
      </div>
      <ul className="pw-list">
        {ORDER.map((id) => {
          const r = RULES.find((x) => x.id === id);
          const ok = r.test(password);
          return (
            <li key={id} className={ok ? 'ok' : ''}>
              {ok ? <CheckCircleRounded /> : <RadioButtonUncheckedRounded />}
              <span>{r.label}</span>
              <span className="visually-hidden" style={{ position: 'absolute', left: -9999 }}>{ok ? '(done)' : '(missing)'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
