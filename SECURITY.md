# Security policy

## Reporting a vulnerability

Please report security problems privately. Use GitHub's **private vulnerability reporting**: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue, pull request or discussion for a security problem.

Please include:

- the LabTracer version or commit,
- your operating system and Python version,
- the steps to reproduce the problem and what an attacker gains.

You should get an answer within 7 days. Once a fix is available, we publish an advisory, and we credit you unless you ask us not to.

## Supported versions

Only the latest commit on `main` gets security fixes. There are no maintained release branches yet.

## Supported deployment model

LabTracer is currently a **single-user tool that runs on your own computer**. Its security is designed around that:

- `server.py` listens on `127.0.0.1` only, by default.
- There is **no authentication**. Anyone who can reach the port can use the app, including other users logged in to the same computer.
- When `server.py` listens on an address that is not loopback, it turns off the features that log in to devices: the SSH console, collect, push, restore, discovery and remote access. The rest of the API stays open, without authentication.

Do not expose LabTracer to a network or run it on a shared multi-user host. Multi-user and enterprise deployment (authentication, roles, TLS) is planned. Until it is in place, reports that only show "an unauthenticated user on the network can use the API" are expected behavior, not vulnerabilities. Reports that show how to get past the loopback, Origin, Host or CSRF protections are in scope.

## Hardening tips for today

- Run LabTracer as a user account whose SSH keys and ssh-agent may be used for the devices in your labs, and for nothing else. LabTracer logs in with that account's keys.
- Keep the `data/` folder private. It holds device configs and backups, which can contain device secrets, and `data/monitor.json`, which holds the monitoring tokens in plain text.
- Run guacd on the same host as LabTracer (`127.0.0.1:4822`), or turn on TLS to it.
- Check `data/audit/` after changes made with push, restore or discovery. Use **Verify** in the audit view to check the hash chain.
