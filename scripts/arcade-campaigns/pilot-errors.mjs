export class PilotError extends Error {
  constructor(code, message, status = 400) {
    super(message); this.name = 'PilotError'; this.code = code; this.status = status;
  }
}

export function pilotDatabaseError(message) {
  const errors = [
    ['invalid-session', 'invalid-session', 'Sign in to the Arcade again.', 401],
    ['challenge-not-found', 'pilot-not-found', 'This pilot is unavailable.', 404],
    ['challenge-not-open', 'pilot-not-open', 'This pilot is not open for play.', 409],
    ['challenge-rules-conflict', 'rules-changed', 'Reload the pilot rules before starting.', 409],
    ['challenge-attempt-not-found', 'attempt-not-found', 'This attempt is unavailable for this session.', 404],
    ['challenge-attempt-expired', 'attempt-expired', 'This attempt has expired.', 409],
    ['challenge-attempt-completed', 'attempt-finished', 'This attempt has already finished.', 409],
    ['challenge-version-conflict', 'version-conflict', 'Reload the attempt before making another move.', 409],
    ['challenge-request-conflict', 'request-conflict', 'This request identifier was already used for a different move.', 409],
    ['challenge-attempt-limit', 'attempt-limit', 'Too many active attempts. Finish a current attempt or wait for it to expire.', 429],
  ];
  const found = errors.find(([marker]) => typeof message === 'string' && message.includes(marker));
  return found ? new PilotError(found[1], found[2], found[3]) : new PilotError('service-unavailable', 'Challenge verification is temporarily unavailable.', 503);
}
