"""Owner-run recovery of the five EXISTING TREE runtime database credentials.

Never run in CI or paste a management token into chat. No checkout enablement.
The database and secret API writes are NOT atomic: failed verification leaves
accounts disabled and requires manual inspection before any further attempt.
"""
from __future__ import annotations
import getpass
import re
import sys
import time
import uuid
import warnings
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from tree_runtime_setup import (
    Api, SetupError, MESSAGES, PROJECT, MODES, LOGINS, SECRET_NAMES,
    SETUP_SECRET, ALL_SECRETS, credentials, scram_verifier,
    sql_literal, successful_probe, check_policy, POLICY_SQL
)
from recovery_preflight import audit, SQL as ROLES_SQL

def rotation_sql(passwords: dict[str,str], tag: str) -> str:
    """Rotate ONLY tagged, disabled accounts; submit SCRAM verifiers, not plaintext."""
    if set(passwords)!=set(MODES) or not re.fullmatch(r'TREE_RUNTIME_SETUP_V1:[a-f0-9-]{36}',tag):
        raise SetupError('roles-not-ready')
    names=','.join(map(sql_literal,LOGINS.values()))
    statements=[
        "BEGIN;",
        "SET LOCAL lock_timeout='5s';",
        "SET LOCAL statement_timeout='20s';",
        "SELECT pg_advisory_xact_lock(hashtextextended('tree-runtime-setup-v1',0));",
        "DO $guard$ BEGIN",
        "IF (SELECT count(*) FROM pg_roles WHERE rolname IN ("+names+") AND NOT rolcanlogin AND shobj_description(oid,'pg_authid')="+sql_literal(tag)+") <> 5 THEN RAISE EXCEPTION 'tree_recovery_role_state'; END IF;",
        "END $guard$;"
    ]
    for mode in MODES:
        statements.append("ALTER ROLE "+LOGINS[mode]+" PASSWORD "+sql_literal(scram_verifier(passwords[mode]))+";")
    statements.extend(["COMMIT;","SELECT true AS updated;"])
    return "\n".join(statements)

def set_login_sql(tag: str, enabled: bool) -> str:
    if not re.fullmatch(r'TREE_RUNTIME_SETUP_V1:[a-f0-9-]{36}',tag) or type(enabled) is not bool:
        raise SetupError('roles-not-ready')
    names=','.join(map(sql_literal,LOGINS.values()))
    return """BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
SELECT pg_advisory_xact_lock(hashtextextended('tree-runtime-setup-v1',0));
DO $guard$ DECLARE r record; BEGIN
IF (SELECT count(*) FROM pg_roles WHERE rolname IN ("""+names+""") AND
 shobj_description(oid,'pg_authid')="""+sql_literal(tag)+""") <> 5
 THEN RAISE EXCEPTION 'tree_recovery_role_state'; END IF;
FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ("""+names+""")
LOOP EXECUTE format('ALTER ROLE %I """+('LOGIN' if enabled else 'NOLOGIN')+"""',r.rolname);
END LOOP; END $guard$; COMMIT; SELECT true AS updated;"""

def run_recovery(api, confirm, progress, sleeper=time.sleep):
    """One attempt only; no blind retry of database or secret writes."""
    audit(api)
    rows=api.query(ROLES_SQL)
    tag=rows[0]['setup_tag']
    if any(row['setup_tag']!=tag for row in rows):raise SetupError('roles-not-ready')
    if not confirm(
        "Recover FIVE existing TREE service credentials in project "+PROJECT+
        ".\nThis will replace five stored database passwords and six TREE secrets."+
        "\nIf hosted verification fails, logins are disabled and manual review is required."+
        "\nTREE payments remain OFF. Proceed?"):
        raise SetupError('cancelled')
    audit(api)
    # Use the currently advertised shared transaction pooler.
    from tree_runtime_setup import choose_pooler
    pool=choose_pooler(api.request('GET','/config/database/pooler'))
    passwords,values=credentials(pool)
    touched=False
    try:
        progress('Rotating the five tagged NOLOGIN credentials...')
        touched=True
        api.query(rotation_sql(passwords,tag),read_only=False)
        progress('Updating only the six named TREE secrets...')
        api.request('POST','/secrets',[{'name':k,'value':values[k]} for k in sorted(ALL_SECRETS)])
        if not ALL_SECRETS.issubset(__import__('tree_runtime_setup').secret_names(api.request('GET','/secrets'))):
            raise SetupError('partial-setup')
        check_policy(api.query(POLICY_SQL))
        progress('Temporarily enabling tagged accounts for hosted read-only verification...')
        api.query(set_login_sql(tag,True),read_only=False)
        for attempt in range(6):
            try:
                if successful_probe(api.probe(values[SETUP_SECRET])):
                    check_policy(api.query(POLICY_SQL))
                    return 'RUNTIME CREDENTIALS VERIFIED — payments remain OFF'
            except SetupError:
                pass
            if attempt<5:sleeper(5)
        raise SetupError('verification-pending')
    except BaseException:
        if touched:
            try:api.query(set_login_sql(tag,False),read_only=False)
            except Exception:pass
        raise SetupError('partial-setup') from None
    finally:
        passwords.clear();values.clear()

def main():
    print('TREE runtime recovery: ONE attempt only; payments stay OFF.')
    print('Never share token, connection strings, or database passwords.')
    api=None
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',getpass.GetPassWarning)
            token=getpass.getpass('Temporary scoped Supabase PAT (hidden): ').strip()
        api=Api(token);token=''
        def confirm(message):
            return input(message+'\nType RECOVER to authorize: ').strip()=='RECOVER'
        print(run_recovery(api,confirm,print))
    except SetupError as e:
        print('RECOVERY STOPPED: '+MESSAGES.get(str(e),MESSAGES['partial-setup']))
    except Exception:
        print('RECOVERY STOPPED: status uncertain; do not retry; inspect the five roles.')
    finally:
        if api:api.clear()
        print('Revoke temporary PAT after attempt. Do not rerun if partial.')
if __name__=='__main__':main()
