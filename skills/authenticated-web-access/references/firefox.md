# Firefox cookie source

Use this reference when the core authenticated-web-access workflow calls for an existing Firefox cookie session. Firefox's on-disk cookie database supplies a short-lived requesting client. The core workflow owns the HTTP request, redirect and output flow, credential exclusions, and account verification

## Locate the profile and context

- Discover Firefox's profile location from its local profile configuration and available process metadata rather than guessing a directory
- Select the profile, container, and partition context for the intended HTTPS host and account or workspace before reading cookie values
    - The default profile is not proof of the signed-in account. The core workflow verifies the actual account through a bounded request
    - If multiple plausible profiles or contexts remain, ask which one to use rather than trying their credentials

## Open the cookie database

- Before **any** opening of `cookies.sqlite`, including for metadata queries, disclose that SQLite read-only access to a live profile can create or update WAL coordination sidecars and obtain approval for that access
    - If the profile must remain unchanged, use an available read-only filesystem view exposing the database and its existing WAL sidecars, or stop if no consistent read is possible
- After approval, open the selected database in SQLite read-only mode and read its current transactional state, including the WAL when present
    - Do not use `immutable=1` against an active Firefox database or copy only its main file. Either can miss committed cookies in the WAL

## Select and hand off cookies

- Inspect only `moz_cookies` metadata relevant to the target host and its applicable parent domains
    - Include cookie name, host, path, expiry, secure flag, and `originAttributes`
- Keep the selected container and partition contexts distinct through `originAttributes`
    - Preserve host and path as well. Do not collapse cookies into a dictionary keyed only by name
- Establish the required cookie names and any CSRF cookie/header relationship from this metadata and the core workflow's site-specific request evidence before reading values
- Read only those selected cookie values inside the process that will make the HTTP request, using the same approved read-only access method
    - Apply the selected host/domain, path, expiry, HTTPS, and `originAttributes` constraints
- Hand the selected context and cookies directly in memory to the requesting client
