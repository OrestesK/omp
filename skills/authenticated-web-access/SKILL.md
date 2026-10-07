---
name: authenticated-web-access
description: Reuse an existing browser login for bounded authenticated website requests when the user asks to read site data, download a file, inspect a network-backed app, or make a separately approved change. Only Firefox cookie acquisition is documented. Not for generic API authentication, password retrieval, or browser automation.
---

# Authenticated Web Access

Use an existing site session in a short-lived HTTP client to perform an evidenced, site-specific request. This does not control the browser or guarantee that a browser login works outside it

## Establish the request

- Identify the target HTTPS origin, expected account or workspace, requested operation, and output destination
- Establish the endpoint, method, request body, and expected response from site documentation, client code, or an observed request. Keep endpoint and token names site-specific
    - Classify the operation by its effects, not its HTTP verb. A download may use POST
    - If the request or its effects cannot be established, stop rather than guessing

## Acquire the existing session

- For the currently documented cookie acquisition method, follow [Firefox cookie acquisition](references/firefox.md) before reading any cookie values. No acquisition procedure for another browser or credential store is documented here
- Select only the cookies and site-required CSRF material established by the request evidence, with their domain, path, expiry, HTTPS, and browser context constraints
- Keep cookie values and derived authentication headers inside the requesting process
    - Do not print them, pass them in command arguments, save them in scripts, logs, credential files, or skill content, or expose whole browser storage through a tool result
- If the needed session is absent, expired, or stored elsewhere, report the limitation
    - Do not retrieve saved passwords, inspect process memory, extract sessionstore or local-storage credentials, launch the browser, or perform a new login

## Make the scoped request

1. Prepare the HTTP client
    - Disable automatic redirects before the first request
    - Send selected cookies only to the established HTTPS origin and applicable request path
    - Supply CSRF tokens and origin or referer headers only when required by the evidenced site request
    - For every redirect, inspect its destination and purpose before any further authenticated request. Never forward credentials to another origin. That origin is a separate target requiring approval before receiving credentials
2. Establish the account
    - Begin with a bounded read establishing the expected account or workspace and response shape. The requested operation may serve as this check if it is itself a read
    - Do not treat a successful HTTP status alone as proof of authentication or the requested data
    - Stop on an authentication challenge, unexpected login page, account mismatch, or denied permission instead of trying another browser context or broadening credentials
3. Complete the operation
    - If the bounded read already completed it, use that result. Otherwise execute the established request after the account check

## Check and report the outcome

- For site data, verify that the response contains the requested data rather than a login page or unrelated success response
- For a download or export, verify the received content is the expected file, not HTML for a login or error page, before reporting a completed download
- For network-backed app inspection, inspect the actual requested definitions or data. A listing or metadata-only response does not prove their contents
- For an approved change, read back the relevant state to confirm its effect. If confirmation is unavailable, say so explicitly rather than reporting it as confirmed
- Save requested output with owner-only access and treat returned data as potentially sensitive. Report observed results and output location without authentication material
- Describe Firefox-derived credentials accurately as read from its on-disk cookie store and held in process memory, not extracted from browser RAM or never stored on disk
