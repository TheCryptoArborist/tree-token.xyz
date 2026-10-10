"""One-time TREE runtime credential setup. Python 3.10+, standard library only.

Run on the project owner's computer. The Management API token is entered locally,
used only against api.supabase.com, and never saved or sent to ChatGPT. This tool
creates NEW credentials, not checkout keys, wallet keys, or payment permissions.
The separate runtime-check endpoint performs read-only login/privilege tests.
"""
from __future__ import annotations
import base64
import getpass
import hashlib
import hmac
import json
import re
import secrets
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import warnings
from dataclasses import dataclass
from typing import Any, Callable

PROJECT = 'lehswszuekjqottolmsf'
API_ROOT = 'https://api.supabase.com'
PREFIX = f'/v1/projects/{PROJECT}'
CHECK_URL = f'https://{PROJECT}.supabase.co/functions/v1/tree-continue-runtime-check'
TOKEN_PAGE = 'https://supabase.com/dashboard/account/tokens'
AUTH_ORIGIN = 'https://deploy-preview-48--tree-token.netlify.app'
ADMIN = '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4'
PILOT = '0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6'
MODES = ('orders', 'settlement', 'storage', 'delivery', 'recovery')
LOGINS = {m: f'tree_continue_{m}_app_v1' for m in MODES}
GROUPS = {m: f'tree_continue_{m}' for m in MODES}
SECRET_NAMES = {m: f'TREE_CONTINUE_{m.upper()}_DB_URL' for m in MODES}
SETUP_SECRET = 'TREE_CONTINUE_SETUP_TOKEN'
ALL_SECRETS = set(SECRET_NAMES.values()) | {SETUP_SECRET}
TAG_PREFIX = 'TREE_RUNTIME_SETUP_V1:'

class SetupError(Exception):
    """Only fixed, nonsensitive error codes are displayed by the UI."""

MESSAGES = {
    'token-required': 'Enter a Supabase personal access token in this LOCAL window, not in chat.',
    'project-not-ready': 'The expected Supabase project is not active. No setup changes were made.',
    'policy-not-disabled': 'The checkout policy differs from the reviewed disabled state. Setup stopped.',
    'roles-not-ready': 'The existing permission roles differ from the reviewed setup. Setup stopped.',
    'already-configured': 'These application roles or secret names already exist. Nothing was overwritten. Report this status for review.',
    'pooler-unavailable': 'A supported primary SCRAM transaction-pooler connection was not returned. Nothing was provisioned.',
    'unexpected-response': 'Supabase returned an unexpected response. No response contents or credentials were displayed.',
    'permission-denied': 'The token lacks required access, or the session has expired. Review its project and permission scopes.',
    'network-error': 'The request failed or timed out. Its outcome may need verification; do not repeatedly rerun setup.',
    'redirect-refused': 'An unexpected redirect was refused. No token was forwarded to the redirect target.',
    'secret-conflict': 'A setup secret appeared during provisioning. It was not overwritten; newly created logins remain disabled.',
    'verification-pending': 'Credentials were installed, but hosted login checks did not pass. Newly created logins were disabled where possible.',
    'partial-setup': 'Setup did not finish. New logins were disabled where possible. Existing credentials were not reset. Report PARTIAL SETUP for review.',
    'cancelled': 'Cancelled before provisioning. No changes were made.',
    'unexpected-error': 'Setup stopped with an unexpected error. Secret values and response contents were suppressed.',
}

def fail(code: str) -> None:
    raise SetupError(code)

def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"

def as_rows(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or not all(isinstance(r, dict) for r in value):
        fail('unexpected-response')
    return value

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        fail('redirect-refused')

class Api:
    """Fixed-origin HTTPS client. No raw request/response/error logging."""
    def __init__(self, token: str):
        if not isinstance(token, str) or not re.fullmatch(r'sbp_[A-Za-z0-9_-]{20,4096}', token):
            fail('token-required')
        self._token = token
        self._opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            urllib.request.HTTPSHandler(context=ssl.create_default_context()), NoRedirect())

    def clear(self):
        # Python cannot guarantee physical erasure of immutable strings; do not
        # claim memory zeroization. No token is deliberately persisted to disk.
        self._token = ''

    def _request(self, url: str, method: str, body: Any, bearer: str) -> Any:
        data = None if body is None else json.dumps(body, separators=(',', ':')).encode('utf-8')
        request = urllib.request.Request(url, method=method, data=data, headers={
            'Authorization': 'Bearer ' + bearer,
            'Content-Type': 'application/json', 'Accept': 'application/json',
            'User-Agent': 'TREE-Runtime-Setup/1.0'})
        try:
            with self._opener.open(request, timeout=45) as response:
                content = response.read(1_000_001)
                if len(content) > 1_000_000:
                    fail('unexpected-response')
                return json.loads(content.decode('utf-8')) if content.strip() else None
        except SetupError:
            raise
        except urllib.error.HTTPError as error:
            status = error.code
            error.close()  # Never print error bodies: SQL errors can contain values.
            if status in (301, 302, 303, 307, 308): fail('redirect-refused')
            if status in (401, 403): fail('permission-denied')
            fail('network-error')
        except (ValueError, UnicodeError):
            fail('unexpected-response')
        except Exception:
            fail('network-error')

    def request(self, method: str, suffix: str = '', body: Any = None) -> Any:
        allowed = {('GET', ''), ('GET', '/secrets'), ('POST', '/secrets'),
                   ('GET', '/config/database/pooler'), ('POST', '/database/query')}
        if (method, suffix) not in allowed:
            fail('unexpected-response')
        return self._request(API_ROOT + PREFIX + suffix, method, body, self._token)

    def query(self, query: str, read_only: bool = True) -> list[dict[str, Any]]:
        return as_rows(self.request('POST', '/database/query', {'query': query, 'read_only': read_only}))

    def probe(self, token: str) -> dict[str, Any]:
        if not re.fullmatch(r'[a-f0-9]{64}', token): fail('unexpected-response')
        result = self._request(CHECK_URL, 'POST', {'action': 'check'}, token)
        if not isinstance(result, dict): fail('unexpected-response')
        return result

POLICY_SQL = """SELECT new_orders_enabled,settlement_enabled,auth_origin,environment,
 admin_wallet,pilot_wallet,deployment IS NULL AS deployment_unconfigured,
 total_limit_raw::text,reserved_raw::text
 FROM tree_continue_v1.commerce_policy WHERE singleton;"""

def check_policy(rows: list[dict[str, Any]]) -> None:
    expected = dict(new_orders_enabled=False, settlement_enabled=False,
                    auth_origin=AUTH_ORIGIN, environment='release-candidate',
                    admin_wallet=ADMIN, pilot_wallet=PILOT, deployment_unconfigured=True,
                    total_limit_raw='0', reserved_raw='0')
    if len(rows) != 1 or set(rows[0]) != set(expected): fail('policy-not-disabled')
    if any(type(rows[0][k]) is not type(v) or rows[0][k] != v for k,v in expected.items()):
        fail('policy-not-disabled')

ROLE_SQL = """SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
 FROM pg_roles WHERE rolname IN (%s) ORDER BY rolname;""" % ','.join(
    sql_literal(r) for r in (*GROUPS.values(), *LOGINS.values()))

def check_roles(rows: list[dict[str, Any]]) -> None:
    if any(r.get('rolname') in LOGINS.values() for r in rows): fail('already-configured')
    if {r.get('rolname') for r in rows} != set(GROUPS.values()): fail('roles-not-ready')
    flags = ('rolcanlogin','rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls')
    if any(any(r.get(k) is not False for k in flags) for r in rows): fail('roles-not-ready')

def secret_names(value: Any) -> set[str]:
    rows = as_rows(value)
    if any(not isinstance(r.get('name'), str) for r in rows): fail('unexpected-response')
    # Do not inspect, print, save or return the secret value/digest field.
    return {r['name'] for r in rows}

@dataclass(frozen=True)
class Pooler:
    host: str
    port: int
    tenant: str


def choose_pooler(value: Any) -> Pooler:
    candidates = []
    for row in as_rows(value):
        if row.get('database_type') != 'PRIMARY' or row.get('pool_mode') != 'transaction': continue
        host, port, user = row.get('db_host'), row.get('db_port'), row.get('db_user')
        if (not isinstance(host,str) or not re.fullmatch(r'[a-z0-9-]+\.pooler\.supabase\.com', host)
                or type(port) is not int or port != 6543 or row.get('db_name') != 'postgres'
                or row.get('is_using_scram_auth') is not True or user != 'postgres.' + PROJECT):
            continue
        candidates.append(Pooler(host,port,PROJECT))
    if len(candidates) != 1: fail('pooler-unavailable')
    return candidates[0]


def scram_verifier(password: str, salt: bytes | None = None, iterations: int = 16384) -> str:
    if not re.fullmatch(r'[A-Za-z0-9_-]{48}',password): fail('unexpected-response')
    salt = secrets.token_bytes(16) if salt is None else salt
    if len(salt) != 16 or iterations < 4096: fail('unexpected-response')
    salted = hashlib.pbkdf2_hmac('sha256', password.encode('ascii'), salt, iterations)
    client_key = hmac.new(salted,b'Client Key',hashlib.sha256).digest()
    stored = hashlib.sha256(client_key).digest()
    server = hmac.new(salted,b'Server Key',hashlib.sha256).digest()
    b64 = lambda b: base64.b64encode(b).decode('ascii')
    return f'SCRAM-SHA-256${iterations}:{b64(salt)}${b64(stored)}:{b64(server)}'


def credentials(pooler: Pooler) -> tuple[dict[str,str],dict[str,str]]:
    passwords, values = {}, {}
    for mode in MODES:
        password = secrets.token_urlsafe(36)
        passwords[mode] = password
        username = LOGINS[mode] + '.' + PROJECT
        values[SECRET_NAMES[mode]] = f'postgresql://{username}:{password}@{pooler.host}:{pooler.port}/postgres'
    values[SETUP_SECRET] = secrets.token_hex(32)
    return passwords, values


def disabled_guard() -> str:
    return f"""IF NOT EXISTS(SELECT 1 FROM tree_continue_v1.commerce_policy WHERE singleton
 AND NOT new_orders_enabled AND NOT settlement_enabled AND deployment IS NULL
 AND total_limit_raw=0 AND reserved_raw=0 AND admin_wallet={sql_literal(ADMIN)}
 AND pilot_wallet={sql_literal(PILOT)} AND auth_origin={sql_literal(AUTH_ORIGIN)}
 AND environment='release-candidate') THEN RAISE EXCEPTION 'tree_setup_policy_changed'; END IF;"""


def create_roles_sql(passwords: dict[str,str], batch: str) -> str:
    if set(passwords) != set(MODES) or str(uuid.UUID(batch)) != batch: fail('unexpected-response')
    lines = ["BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';",
             "SELECT pg_advisory_xact_lock(hashtextextended('tree-runtime-setup-v1',0));",
             'DO $tree_setup$ BEGIN', disabled_guard(),
             'IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN (' + ','.join(map(sql_literal,LOGINS.values())) +
             ")) THEN RAISE EXCEPTION 'tree_setup_existing_login'; END IF; END $tree_setup$;"]
    for mode in MODES:
        login, group = LOGINS[mode], GROUPS[mode]
        # Send a SCRAM verifier, never the cleartext DB password, in SQL.
        verifier = scram_verifier(passwords[mode])
        lines += [f'CREATE ROLE {login} NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 4 PASSWORD {sql_literal(verifier)};',
                  f'GRANT {group} TO {login} WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;',
                  f'GRANT CONNECT ON DATABASE postgres TO {login};',
                  f"ALTER ROLE {login} SET search_path='pg_catalog';",
                  f"ALTER ROLE {login} SET statement_timeout='15s';",
                  f"ALTER ROLE {login} SET idle_in_transaction_session_timeout='15s';",
                  f'COMMENT ON ROLE {login} IS {sql_literal(TAG_PREFIX+batch)};']
    lines += ['COMMIT;', "SELECT true AS created;"]
    return '\n'.join(lines)


def switch_logins_sql(batch: str, enable: bool) -> str:
    if str(uuid.UUID(batch)) != batch or type(enable) is not bool: fail('unexpected-response')
    # Restrict cleanup/activation to exactly the roles created by this run.
    names = ','.join(map(sql_literal,LOGINS.values()))
    guard = disabled_guard() if enable else ''
    if enable:
        guard += f"IF (SELECT count(*) FROM pg_roles WHERE rolname IN ({names}) AND shobj_description(oid,'pg_authid')={sql_literal(TAG_PREFIX+batch)})<>5 THEN RAISE EXCEPTION 'tree_setup_batch_incomplete'; END IF;"
    return f"""BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
 DO $tree_setup$ DECLARE r record; BEGIN {guard}
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ({names})
 AND shobj_description(oid,'pg_authid')={sql_literal(TAG_PREFIX+batch)} LOOP
 EXECUTE format('ALTER ROLE %I {'LOGIN' if enable else 'NOLOGIN'}',r.rolname);
 END LOOP; END $tree_setup$; COMMIT; SELECT true AS updated;"""


def successful_probe(result: Any) -> bool:
    return (isinstance(result,dict) and result.get('protocol') == 'tree-runtime-check.v1'
            and result.get('projectRef') == PROJECT and result.get('credentialsVerified') is True
            and result.get('paymentsEnabled') is False and result.get('restoreAuthorized') is False
            and result.get('policyDisabled') is True and result.get('checkedRoles') == list(MODES))


def run_setup(api: Api, confirm: Callable[[str],bool], progress: Callable[[str],None],
              sleeper: Callable[[float],None] = time.sleep) -> dict[str,Any]:
    progress('Checking the existing project and disabled payment policy...')
    project = api.request('GET')
    if not isinstance(project,dict) or project.get('id') != PROJECT or project.get('status') != 'ACTIVE_HEALTHY':
        fail('project-not-ready')
    check_policy(api.query(POLICY_SQL))
    check_roles(api.query(ROLE_SQL))
    if secret_names(api.request('GET','/secrets')) & ALL_SECRETS: fail('already-configured')
    pooler = choose_pooler(api.request('GET','/config/database/pooler'))
    summary = ('Project: TheCryptoArborist\'s Project\nRef: ' + PROJECT +
        '\n\nCreate five NEW restricted application logins and six protected settings.'
        '\nExisting passwords and API keys will not be reset.'
        '\nNo purchase, token transfer, contract publication, or checkout activation.'
        '\n\nContinue with secure setup?')
    if not confirm(summary): fail('cancelled')
    # Re-read immediately before creation; do not create from a stale preflight.
    check_policy(api.query(POLICY_SQL))
    passwords, values = credentials(pooler)
    batch = str(uuid.uuid4())
    attempted = False
    try:
        progress('Creating new logins in a disabled state...')
        attempted = True
        api.query(create_roles_sql(passwords,batch),read_only=False)
        # The API upserts secrets. Fail on any existing name instead of replacing.
        if secret_names(api.request('GET','/secrets')) & ALL_SECRETS: fail('secret-conflict')
        progress('Installing the generated credentials directly in Supabase Secrets...')
        api.request('POST','/secrets',[{'name':k,'value':v} for k,v in values.items()])
        installed = secret_names(api.request('GET','/secrets'))
        if not ALL_SECRETS <= installed: fail('partial-setup')
        progress('Enabling only the newly created restricted logins...')
        api.query(switch_logins_sql(batch,True),read_only=False)
        progress('Checking actual hosted logins and permissions (payments remain disabled)...')
        # Only the read-only probe is retried. Never retry a credential write.
        for attempt in range(6):
            try:
                result = api.probe(values[SETUP_SECRET])
                if successful_probe(result):
                    check_policy(api.query(POLICY_SQL))
                    return {'status':'RUNTIME CREDENTIALS VERIFIED','projectRef':PROJECT,
                            'paymentsEnabled':False,'roles':list(MODES),'batchId':batch}
            except SetupError:
                pass
            if attempt < 5: sleeper(5)
        fail('verification-pending')
    except BaseException as error:
        if attempted:
            try: api.query(switch_logins_sql(batch,False),read_only=False)
            except Exception: pass
        # No delete, password reset, or bulk secret cleanup on ambiguous failure.
        if isinstance(error,SetupError) and str(error) in ('verification-pending','secret-conflict'):
            raise
        raise SetupError('partial-setup') from None
    finally:
        passwords.clear(); values.clear()


def gui() -> None:
    import threading
    import tkinter as tk
    from tkinter import messagebox, ttk
    import webbrowser
    root = tk.Tk(); root.title('TREE — Secure Runtime Setup'); root.geometry('690x600')
    root.minsize(650,560)
    frame=ttk.Frame(root,padding=24); frame.pack(fill='both',expand=True)
    ttk.Label(frame,text='TREE — Secure Runtime Setup',font=('Segoe UI',18,'bold')).pack(anchor='w')
    text=('One-time setup for your EXISTING Supabase project.\n'
          'Creates five restricted database logins and saves their values directly\n'
          'in Supabase Secrets. It does not enable sales or move tokens.\n\n'
          'Create a short-lived Supabase personal access token. Scope it to this\n'
          'project where available: Project Settings Read, Database Read-write,\n'
          'Connection Pooling Read, and Edge Function Secrets Read-write.\n'
          'A classic token has broader account access. Revoke it after setup.\n\n'
          'Paste the token only below. Never send it in chat or a screenshot.')
    ttk.Label(frame,text=text,justify='left',font=('Segoe UI',10)).pack(anchor='w',pady=16)
    ttk.Button(frame,text='Open official Supabase access-token page',
               command=lambda:webbrowser.open(TOKEN_PAGE)).pack(anchor='w')
    ttk.Label(frame,text='Local access token (hidden):').pack(anchor='w',pady=(18,4))
    token=tk.StringVar(); entry=ttk.Entry(frame,textvariable=token,show='*',width=76); entry.pack(fill='x')
    status=tk.StringVar(value='Ready. Nothing has been changed.')
    ttk.Label(frame,textvariable=status,wraplength=630,justify='left').pack(anchor='w',pady=16)
    busy=False
    def progress(message): root.after(0,lambda:status.set(message))
    def ask(message):
        event=threading.Event(); answer=[]
        def show():
            answer.append(messagebox.askyesno('Confirm TREE setup',message,parent=root)); event.set()
        root.after(0,show); event.wait(); return answer[0]
    def work(value):
        api=None
        try:
            api=Api(value)
            result=run_setup(api,ask,progress)
            message=(result['status']+'\n\nPayments are still OFF. No contract was published.\n'
                     'Revoke the temporary Supabase token now.\n'
                     'Report only: RUNTIME CREDENTIALS VERIFIED')
        except SetupError as error: message=MESSAGES.get(str(error),MESSAGES['unexpected-error'])
        except Exception: message=MESSAGES['unexpected-error']
        finally:
            if api: api.clear()
        def finish():
            nonlocal busy
            busy=False; button.config(state='normal'); entry.config(state='normal'); status.set(message)
        root.after(0,finish)
    def start():
        nonlocal busy
        if busy:return
        value=token.get().strip(); token.set('')
        busy=True; button.config(state='disabled'); entry.config(state='disabled')
        threading.Thread(target=work,args=(value,),daemon=False).start()
    button=ttk.Button(frame,text='Prepare secure runtime — keep payments OFF',command=start)
    button.pack(anchor='w',pady=8)
    ttk.Label(frame,text='No PowerShell, Node.js, Supabase CLI, database password, or wallet key is needed.',
              wraplength=630).pack(anchor='w',pady=10)
    def close():
        if busy: messagebox.showinfo('Setup running','Wait for the result before closing this window.',parent=root)
        else: root.destroy()
    root.protocol('WM_DELETE_WINDOW',close); root.mainloop()


def console() -> None:
    print('TREE secure runtime setup — payments stay OFF. Token is entered locally only.')
    print('Official token page: '+TOKEN_PAGE)
    api=None
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error',getpass.GetPassWarning)
            token=getpass.getpass('Supabase personal access token (hidden): ').strip()
        api=Api(token); token=''
        result=run_setup(api,lambda message: input(message+'\nType YES: ').strip()=='YES',print)
        print(result['status']); print('Payments remain OFF. Revoke the temporary access token.')
    except SetupError as error: print(MESSAGES.get(str(error),MESSAGES['unexpected-error']))
    except (EOFError,KeyboardInterrupt,getpass.GetPassWarning): print('Setup stopped; no credentials displayed.')
    except Exception: print(MESSAGES['unexpected-error'])
    finally:
        if api: api.clear()

if __name__=='__main__':
    if '--console' in sys.argv: console()
    else: gui()
