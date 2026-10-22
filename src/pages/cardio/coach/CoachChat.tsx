// "שאלו את מאמן הריצה" — a short chat with the AI coach, grounded in the
// runner's numbers. Same consent and reporting pattern as the exercise Q&A:
// the first send says what leaves the app, and the button reads "אישור ושליחה"
// until it is pressed once. The AI answers only a signed-in account, so a
// guest sees the way to sign in instead of a question that would fail.

import { LogIn, RotateCcw } from 'lucide-react';
import { type FormEvent, useId, useRef, useState } from 'react';
import { AiAnswerFooter } from '../../../components/ai/AiAnswerFooter';
import { useAuth } from '../../../contexts/AuthContext';
import { grantAiShareConsent, hasAiShareConsent } from '../../../services/ai/aiConsent';
import { SUGGESTED_QUESTIONS } from '../../../services/ai/runningCoach';
import { useCoachChat } from './useCoachChat';
import './coach-chat.css';

const QUESTION_MAX_CHARS = 600;

interface CoachChatProps {
  /** Builds the runner's brief at send time. */
  getBrief: () => string;
  /** What the answers are about, for a report (e.g. the goal). */
  subject?: string;
}

export function CoachChat(props: CoachChatProps) {
  const { user, clearGuest } = useAuth();
  if (!user) return <SignInToAsk onSignIn={clearGuest} />;
  return <SignedInChat {...props} />;
}

function SignInToAsk({ onSignIn }: { onSignIn: () => void }) {
  const uid = useId();
  return (
    <section className="rc-card" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="rc-title">
        שאלו את מאמן הריצה
      </h2>
      <p className="rc-muted" style={{ fontSize: 14 }}>
        מאמן שעונה לפי הריצות והמטרה שלכם זמין בחשבון מחובר. ההמלצות למעלה עובדות גם בלי.
      </p>
      <button type="button" className="cta-secondary focus-ring" onClick={onSignIn}>
        <LogIn size={18} aria-hidden="true" />
        התחברות או הרשמה
      </button>
    </section>
  );
}

function SignedInChat({ getBrief, subject }: CoachChatProps) {
  const uid = useId();
  const chat = useCoachChat(getBrief);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(() => hasAiShareConsent('running'));
  const sendRef = useRef<HTMLButtonElement>(null);
  const consentId = `${uid}-consent`;
  const canSend = !chat.asking && text.trim().length > 0;

  const send = (question: string) => {
    if (chat.asking || !question.trim()) return;
    // Pressing "אישור ושליחה" under the notice is the explicit permission.
    if (!consent) {
      grantAiShareConsent('running');
      setConsent(true);
    }
    setText('');
    void chat.ask(question);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  /** A suggested question: sent at once after consent, else staged under the notice. */
  const pick = (question: string) => {
    if (consent) {
      send(question);
      return;
    }
    setText(question);
    sendRef.current?.focus();
  };

  const isEmpty = chat.turns.length === 0 && !chat.pending;

  return (
    <section className="rc-card" aria-labelledby={`${uid}-h`}>
      <div className="rc-card-head">
        <h2 id={`${uid}-h`} className="rc-title">
          שאלו את מאמן הריצה
        </h2>
        {chat.turns.length > 0 && (
          <button
            type="button"
            className="cta-ghost focus-ring"
            style={{ paddingInline: 8 }}
            onClick={chat.clear}
            disabled={chat.asking}
          >
            שיחה חדשה
          </button>
        )}
      </div>

      {isEmpty && (
        <p className="rc-muted" style={{ fontSize: 14 }}>
          אימון, קצב, מרוץ או ציוד — המאמן עונה לפי הריצות והמטרה שלכם.
        </p>
      )}

      <div className="rc-chat-log" role="log" aria-label="השיחה עם מאמן הריצה">
        {chat.turns.map((turn, i) =>
          turn.role === 'user' ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: turns are append-only; the index is stable
            <p key={i} className="rc-msg" data-role="user" dir="auto">
              <span className="sr-only">אתם: </span>
              {turn.content}
            </p>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: turns are append-only; the index is stable
            <div key={i} className="rc-msg" data-role="assistant">
              <p className="rc-msg-text" dir="auto">
                <span className="sr-only">המאמן: </span>
                {turn.content}
              </p>
              <AiAnswerFooter
                surface="running_coach"
                subject={subject}
                question={chat.turns[i - 1]?.content ?? ''}
                answer={turn.content}
              />
            </div>
          )
        )}
        {chat.pending && (
          <p className="rc-msg" data-role="user" dir="auto">
            <span className="sr-only">אתם: </span>
            {chat.pending}
          </p>
        )}
        {chat.asking && (
          <div className="rc-typing" role="status">
            <span className="rc-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            המאמן כותב תשובה…
          </div>
        )}
      </div>

      {chat.error && !chat.asking && (
        <div className="rc-error" role="alert">
          <span>{chat.error}</span>
          <button
            type="button"
            className="cta-ghost focus-ring"
            style={{ justifySelf: 'start', paddingInline: 0, gap: 6, color: 'var(--fs-link)' }}
            onClick={chat.retry}
          >
            <RotateCcw size={16} aria-hidden="true" />
            נסו שוב
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="cardio-chips" role="group" aria-label="שאלות לדוגמה">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              className="cardio-chip focus-ring"
              onClick={() => pick(q)}
              disabled={chat.asking}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form className="rc-form" onSubmit={onSubmit}>
        <label htmlFor={`${uid}-q`} className="cardio-label">
          השאלה שלכם
        </label>
        {!consent && (
          <p id={consentId} className="rc-consent">
            כדי לענות, השאלה ונתוני הריצה שלכם (תאריכים, סוג הריצה, מרחקים, זמנים, קצב, דופק והמטרה)
            נשלחים לשירות בינה מלאכותית חיצוני. השם והמייל שלכם לא נשלחים.
          </p>
        )}
        <input
          id={`${uid}-q`}
          className="input"
          type="text"
          dir="auto"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={QUESTION_MAX_CHARS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="למשל: כמה לרוץ השבוע?"
          aria-describedby={consent ? undefined : consentId}
        />
        <button
          ref={sendRef}
          type="submit"
          className="cta-secondary focus-ring"
          // aria-disabled, not disabled: the button keeps focus after a send.
          aria-disabled={!canSend}
          aria-describedby={consent ? undefined : consentId}
          style={canSend ? undefined : { opacity: 0.55, cursor: 'default' }}
        >
          {chat.asking ? 'שולחים…' : consent ? 'שלחו למאמן' : 'אישור ושליחה'}
        </button>
      </form>
    </section>
  );
}
