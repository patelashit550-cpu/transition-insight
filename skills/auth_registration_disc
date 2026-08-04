# Skill: Implement Auth.md Agent Registration Discovery

## What This Skill Does

Helps a service publish Auth.md support for agent registration. Use this when a scanner reports the `authMd` check is failing or when adding the Auth.md standard to an API or application.

## Requirements

- Serve `/auth.md` from the service root as Markdown with an H1 heading that contains `auth.md` (for example, `# auth.md` or `# Example auth.md`).
- Prefer publishing OAuth Protected Resource Metadata at `/.well-known/oauth-protected-resource` for the resource server.
- Include `resource`, `authorization_servers`, `scopes_supported`, and `bearer_methods_supported` with `header` in the PRM document.
- Publish OAuth Authorization Server metadata at each advertised authorization server's `/.well-known/oauth-authorization-server` URL.
- Include a valid `issuer` in Authorization Server metadata and ensure it matches the issuer advertised in PRM.
- Add an `agent_auth` block with `skill`, `register_uri`, and at least one complete registration method when Authorization Server metadata is available.
- If OAuth metadata is not available, keep `/auth.md` self-contained: identify the agent audience, document registration or provisioning endpoint(s), list supported method(s), and explain credential use.

## Flow Metadata

- ID-JAG: include `identity_types_supported: ["identity_assertion"]`, `identity_assertion.assertion_types_supported` with `urn:ietf:params:oauth:token-type:id-jag`, and credential types. Include `revocation_uri` and the revocation event in `events_supported` when supported; scanners may warn when they are omitted, but they are not required for detection.
- Verified email: include `identity_assertion.assertion_types_supported` with `verified_email`, credential types, and `claim_uri`.
- Anonymous: include `identity_types_supported: ["anonymous"]`, `anonymous.credential_types_supported`, and `claim_uri`.

## Notes

Do not probe `POST /agent/auth` during passive scans. Registration can create accounts, send email, or issue credentials. Public discovery documents are the safe source of truth.
