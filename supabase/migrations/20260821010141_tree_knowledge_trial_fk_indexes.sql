create index tree_knowledge_trial_passes_qualifying_tx_idx
  on private.tree_knowledge_trial_passes (qualifying_tx_digest);

create index tree_knowledge_trial_rounds_question_set_idx
  on private.tree_knowledge_trial_rounds (question_set_version);

create index tree_knowledge_trial_rounds_winner_attempt_idx
  on private.tree_knowledge_trial_rounds (winner_attempt_id)
  where winner_attempt_id is not null;

create index tree_knowledge_trial_rounds_winner_tiebreak_attempt_idx
  on private.tree_knowledge_trial_rounds (winner_tiebreak_attempt_id)
  where winner_tiebreak_attempt_id is not null;

create index tree_knowledge_trial_wallet_challenges_qualifying_tx_idx
  on private.tree_knowledge_trial_wallet_challenges (qualifying_tx_digest)
  where qualifying_tx_digest is not null;

create index tree_knowledge_trial_wallet_challenges_round_idx
  on private.tree_knowledge_trial_wallet_challenges (round_id);
