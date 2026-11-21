// Shared fixed-step transport bounds. Server remains authoritative and enforces
// elapsed-time credit; larger batches amortize network/database round trips.
export const SAVE_EVERY_FRAMES=60;
export const MAX_BATCH_FRAMES=600;
export const MAX_PENDING_FRAMES=900;
export const MAX_CLOCK_CREDIT=900;
