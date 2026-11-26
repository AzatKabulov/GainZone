export interface Quote {
  text: string;
  by?: string;
}

/** Short, dry gym lines. No syrup. */
export const QUOTES: Quote[] = [
  { text: 'The last rep is the one that counts.' },
  { text: 'Light weight. Heavy intent.' },
  { text: 'Progressive overload is a promise you keep.' },
  { text: 'Earn the pump.' },
  { text: 'One more rep than last time. That is the whole game.' },
  { text: 'Strength is built in the sets nobody sees.' },
  { text: 'The iron never lies to you.', by: 'Henry Rollins' },
  { text: 'Everybody wants to be a bodybuilder, but nobody wants to lift no heavy-ass weights.', by: 'Ronnie Coleman' },
  { text: 'The resistance that you fight physically in the gym builds strength.', by: 'Arnold Schwarzenegger' },
  { text: 'Discipline is paid daily.' },
  { text: 'Stack the sessions. The results stack themselves.' },
  { text: 'Rest is part of the program. Use it.' },
  { text: 'Form first. Ego later.' },
  { text: 'You do not rise to the occasion. You fall to your training.' },
  { text: 'Show up. Log it. Beat it.' },
  { text: 'Hard sets. Honest numbers.' },
  { text: 'Consistency beats intensity you can’t repeat.' },
  { text: 'The weight does not care how you feel. Lift it anyway.' },
  { text: 'Built, not born.' },
  { text: 'Quiet grind. Loud results.' },
  { text: 'What gets logged gets lifted.' },
  { text: 'Strong is a habit.' },
  { text: 'Pain of discipline or pain of regret.', by: 'Jim Rohn' },
  { text: 'Success isn’t always about greatness. It’s about consistency.', by: 'Dwayne Johnson' },
  { text: 'The body achieves what the mind believes.' },
  { text: 'Lock in. Next set.' },
  { text: 'Win the set in front of you.' },
  { text: 'Training is a vote for the person you are becoming.' },
  { text: 'Slow negatives. Fast progress.' },
  { text: 'Nobody is coming. Pick up the bar.' },
];

let order: number[] = [];

export function nextQuote(): Quote {
  if (!order.length) {
    order = QUOTES.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  return QUOTES[order.pop()!];
}

export const MANTRAS = ['LOCK IN', 'ONE MORE REP', 'EARN IT', 'BEAT LAST TIME', 'NO ZERO WEEKS', 'HEAVY INTENT', 'BUILT, NOT BORN'];
