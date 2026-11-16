/** The JSON the contract's view returns. Field names are the contract's own. */

export type Label = 'FAIR' | 'INCOMPLETE' | 'DISTORTED';
export type TurnStatus = 'STATED' | 'RESTATED' | 'CONTESTED' | 'FAIR' | 'FORFEIT';
export type ThreadStatus = 'OPEN' | 'ACTIVE' | 'DONE' | 'FORFEITED' | 'CLOSED';

export type Totals = { threads: number };

export type Try = { text: string; label: Label };

export type Turn = {
  n: number;
  original: string;
  original_by: string;
  restater: string;
  /** The restatement waiting to be answered or judged; empty between tries. */
  restatement: string;
  tries: number;
  failures: number;
  tries_left: number;
  status: TurnStatus;
  label: '' | Label;
  /** Failed tries, kept so readers can see them. */
  history: Try[];
  opened_at: number;
  restated_at: number;
  answered: '' | 'author' | 'silence' | 'confirmed';
  judged_by: string;
  judged_at: number;
};

export type Thread = {
  found: true;
  totals: Totals;
  id: number;
  author: string;
  opponent: string;
  topic: string;
  position: string;
  window_h: number;
  deposit: string;
  created_at: number;
  joined_at: number;
  status: ThreadStatus;
  phase: '' | 'RESTATE' | 'REPLY';
  turn: number;
  turns_total: number;
  max_tries: number;
  deadline: number;
  loser: string;
  winner: string;
  reason: '' | 'tries' | 'window';
  closed_by: string;
  closed_at: number;
  turns: Turn[];
  author_balance: string;
  opponent_balance: string;
};

export type NotFound = { found: false; totals?: Totals };
