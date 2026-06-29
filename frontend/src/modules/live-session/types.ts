// ── Live Session module · types ──────────────────────────────────────────────

export interface LiveSession {
  id: string;
  topic: string;
  startTime: string;   // ISO
  endTime: string;     // ISO (startTime + 1h)
  isActive: boolean;
  createdBy?: string | null;
}

export interface LiveMessage {
  id: string;
  sessionId: string;
  text: string;
  userSessionId: string;
  timestamp: string;   // ISO (created_at)
}

export interface LivePoll {
  id: string;
  question: string;
  imageUrl?: string | null;
  options: string[];
  createdAt: string;   // ISO
  expiresAt: string;   // ISO (createdAt + 24h)
  isActive: boolean;
}

export interface LivePollVote {
  pollId: string;
  userSessionId: string;
  selectedOption: number;   // index into poll.options
}

/** Tally for one poll: per-option counts + total. */
export interface PollTally {
  counts: number[];
  total: number;
}
