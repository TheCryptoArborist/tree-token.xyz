-- Read-only post-migration verification. No organizer, event or session is seeded.
select jsonb_build_object(
  'counts', (select jsonb_build_object(
    'organizers', (select count(*) from private.arcade_event_organizers),
    'drafts', (select count(*) from private.arcade_event_drafts),
    'history', (select count(*) from private.arcade_event_draft_history),
    'paymentEnabled', (select count(*) from private.arcade_event_drafts where payment_enabled)
  )),
  'rls', (select jsonb_object_agg(c.relname,c.relrowsecurity)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname in ('arcade_event_organizers','arcade_event_drafts','arcade_event_draft_history')),
  'functionAccess', (select jsonb_agg(jsonb_build_object(
    'name',n.nspname||'.'||p.proname,
    'securityDefiner',p.prosecdef,
    'configuration',p.proconfig,
    'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
    'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE')
  ) order by n.nspname,p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname in ('arcade_event_load_draft_v1','arcade_event_save_draft_v1','arcade_event_load_draft_v2','arcade_event_save_draft_v2'))
      or (n.nspname='private' and p.proname='arcade_event_terms_v2')),
  'browserTableAccess', (select jsonb_object_agg(role_name,jsonb_build_object(
    'draftSelect',has_table_privilege(role_name,'private.arcade_event_drafts','SELECT'),
    'draftInsert',has_table_privilege(role_name,'private.arcade_event_drafts','INSERT'),
    'draftUpdate',has_table_privilege(role_name,'private.arcade_event_drafts','UPDATE'),
    'historySelect',has_table_privilege(role_name,'private.arcade_event_draft_history','SELECT'),
    'organizerSelect',has_table_privilege(role_name,'private.arcade_event_organizers','SELECT')
  )) from unnest(array['anon','authenticated']) as role_name),
  'terms',private.arcade_event_terms_v2(),
  'policyConstraint',(select pg_get_constraintdef(oid) from pg_constraint
    where conrelid='private.arcade_event_drafts'::regclass and conname='arcade_event_drafts_policy_check')
) as verification;
