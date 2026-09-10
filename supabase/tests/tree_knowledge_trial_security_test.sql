BEGIN;
SELECT plan(8);

SELECT has_table('private', 'tree_knowledge_trial_rounds', 'Knowledge Trial rounds table exists');
SELECT has_table('private', 'tree_knowledge_trial_passes', 'Knowledge Trial passes table exists');
SELECT has_table('private', 'tree_knowledge_trial_attempts', 'Knowledge Trial attempts table exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.tree_knowledge_trial_rounds'::regclass),
  'rounds enforce row-level security'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.tree_knowledge_trial_passes'::regclass),
  'passes enforce row-level security'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.tree_knowledge_trial_attempts'::regclass),
  'attempts enforce row-level security'
);

SELECT ok(
  NOT has_table_privilege('anon', 'private.tree_knowledge_trial_rounds', 'SELECT')
  AND NOT has_table_privilege('anon', 'private.tree_knowledge_trial_passes', 'SELECT')
  AND NOT has_table_privilege('anon', 'private.tree_knowledge_trial_attempts', 'SELECT'),
  'anonymous clients have no Knowledge Trial table access'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'private.tree_knowledge_trial_rounds', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'private.tree_knowledge_trial_passes', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'private.tree_knowledge_trial_attempts', 'SELECT'),
  'authenticated clients have no direct Knowledge Trial table access'
);

SELECT * FROM finish();
ROLLBACK;
