# Security

Thank you for helping keep ligungi safe.

## Reporting a vulnerability

**Do not open a public issue for security problems.** Use GitHub's private reporting instead:

https://github.com/beater-studios/ligungi/security/advisories/new

Please include, when possible:

- what the issue allows an attacker to do, and its impact;
- steps to reproduce, ideally on a local install (see below);
- the version or commit you tested;
- a suggested fix, if you have one.

We aim to acknowledge reports within 7 days. ligungi is a small project run by volunteers, so a fix may take longer depending on severity. You will get updates on the report itself and, if you want, credit in the advisory published after the fix.

## Supported versions

Only the `main` branch and what runs on https://ligungi.org receive fixes.

## How to test

The project runs locally with `npm install` and `npm run dev` (see the [README](README.md)). Test on your own install, not on the production site.

We ask that you:

- do not access, change or delete other users' data;
- do not run high-volume automated scanners or denial-of-service attacks against ligungi.org;
- give us reasonable time to fix the issue before disclosing it.

Good-faith research within these rules is welcome and will not be treated as an attack.

## Out of scope

- Volumetric denial of service.
- Issues that require prior access to the victim's device or account.
- Missing headers or settings without a demonstrated impact.
- Social engineering and attacks on third-party infrastructure (hosting, CDN and DNS providers, GitHub).
