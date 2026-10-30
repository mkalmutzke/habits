# Security

This is a personal project: one owner, one account. It is public so the code and the build
history can be read and learned from – not to accept contributions.

## How the app protects data

- Every database row belongs to an account and is protected by row level security
  ("own rows only").
- Only the owner's allowlisted address can sign in, with a one-time 8-digit code;
  sign-ups are off.
- No keys, tokens or passwords are stored in this repository. Every change is scanned
  for leaked secrets (gitleaks) and checked by a code scanner (Semgrep).

## Reporting a problem

If you find a security problem, please **don't open a public issue**. Use GitHub's private
report instead: the repository's **Security** tab → **Report a vulnerability**.
Please include what you found and how to reproduce it. You'll get an answer as soon as
possible – this is a one-person project, so please allow a few days.

## Contributions

Pull requests from outside are welcome to read but are generally not merged. Nothing is
merged without the owner's review, and checks from forks only run after approval.
