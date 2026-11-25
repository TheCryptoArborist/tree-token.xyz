select jsonb_build_object(
 'table',to_regclass('private.arcade_bnb_run_reviews')::text,
 'rls',(select relrowsecurity from pg_class where oid='private.arcade_bnb_run_reviews'::regclass),
 'table_acl',(select relacl::text from pg_class where oid='private.arcade_bnb_run_reviews'::regclass),
 'constraints',(select jsonb_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where conrelid='private.arcade_bnb_run_reviews'::regclass),
 'indexes',(select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname='private' and tablename='arcade_bnb_run_reviews'),
 'rows',(select count(*) from private.arcade_bnb_run_reviews),
 'rpc',(select jsonb_build_object('definition_md5',md5(pg_get_functiondef(oid)),'source_md5',md5(prosrc),'security_definer',prosecdef,'config',proconfig,'acl',proacl::text) from pg_proc where oid='public.arcade_bnb_run_review_v1(text,jsonb)'::regprocedure),
 'privileges',(select jsonb_agg(jsonb_build_object('role',r,'schema_usage',has_schema_privilege(r,'private','USAGE'),'select',has_table_privilege(r,'private.arcade_bnb_run_reviews','SELECT'),'insert',has_table_privilege(r,'private.arcade_bnb_run_reviews','INSERT'),'update',has_table_privilege(r,'private.arcade_bnb_run_reviews','UPDATE'),'delete',has_table_privilege(r,'private.arcade_bnb_run_reviews','DELETE'),'execute',has_function_privilege(r,'public.arcade_bnb_run_review_v1(text,jsonb)','EXECUTE')) order by r) from unnest(array['anon','authenticated','service_role']) r)
) as verification;
