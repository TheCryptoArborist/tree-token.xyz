"""Read-only preflight for existing TREE runtime setup.

This is NOT the rotation utility. It cannot modify credentials, logins or secrets.
Enter a short-lived scoped Supabase PAT locally, never in chat or CI.
"""
from __future__ import annotations
import getpass
import sys
import warnings
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from tree_runtime_setup import (Api, SetupError, MESSAGES, PROJECT, POLICY_SQL,
    check_policy, LOGINS, GROUPS, ALL_SECRETS, secret_names, choose_pooler)

SQL = """SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,
 rolreplication,rolbypassrls,rolconnlimit,
 shobj_description(oid,'pg_authid') AS setup_tag
 FROM pg_roles WHERE rolname LIKE 'tree_continue_%_app_v1' ORDER BY rolname"""
MEMBERSHIP_SQL = """SELECT u.rolname AS member,g.rolname AS parent,
 m.inherit_option,m.set_option,m.admin_option FROM pg_auth_members m
 JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.roleid
 WHERE u.rolname LIKE 'tree_continue_%_app_v1' ORDER BY u.rolname,g.rolname"""

def verify_roles(rows, memberships):
    expected = set(LOGINS.values())
    if len(rows)!=5 or {r.get('rolname') for r in rows}!=expected:
        raise SetupError('roles-not-ready')
    tags = set()
    for r in rows:
        if (r.get('rolcanlogin') is not False or r.get('rolinherit') is not True
            or r.get('rolconnlimit')!=4 or any(r.get(k) is not False for k in
            ('rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls'))):
            raise SetupError('roles-not-ready')
        tag = r.get('setup_tag')
        if not isinstance(tag,str) or not tag.startswith('TREE_RUNTIME_SETUP_V1:'):
            raise SetupError('roles-not-ready')
        tags.add(tag)
    if len(tags)!=1: raise SetupError('roles-not-ready')
    expected_memberships = {(LOGINS[m],GROUPS[m]) for m in LOGINS}
    if len(memberships)!=5 or {(x.get('member'),x.get('parent')) for x in memberships}!=expected_memberships:
        raise SetupError('roles-not-ready')
    if any(x.get('inherit_option') is not True or x.get('set_option') is not False
           or x.get('admin_option') is not False for x in memberships):
        raise SetupError('roles-not-ready')
    return True

def audit(api):
    project=api.request('GET')
    if not isinstance(project,dict) or project.get('id')!=PROJECT or project.get('status')!='ACTIVE_HEALTHY':
        raise SetupError('project-not-ready')
    check_policy(api.query(POLICY_SQL))
    verify_roles(api.query(SQL),api.query(MEMBERSHIP_SQL))
    names=secret_names(api.request('GET','/secrets'))
    if not ALL_SECRETS.issubset(names):raise SetupError('already-configured')
    pool=choose_pooler(api.request('GET','/config/database/pooler'))
    if pool.port!=6543 or pool.tenant!=PROJECT:raise SetupError('pooler-unavailable')
    return 'RECOVERY PREFLIGHT READY — all five roles disabled, policy off, six secret names present, shared pooler recognized. Credentials NOT verified.'

def main():
    print('TREE read-only recovery preflight. No passwords, secrets or roles will be changed.')
    print('Token page: https://supabase.com/dashboard/account/tokens')
    api=None
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',getpass.GetPassWarning)
            token=getpass.getpass('Temporary scoped Supabase PAT (hidden): ').strip()
        api=Api(token);token=''
        print(audit(api))
    except SetupError as e:
        print('PREFLIGHT BLOCKED: '+MESSAGES.get(str(e),MESSAGES['unexpected-error']))
    except Exception:
        print('PREFLIGHT BLOCKED: unable to verify safe state; no changes made.')
    finally:
        if api:api.clear()
        print('Revoke the temporary token after use. Do not rerun the original installer.')
if __name__=='__main__':main()
