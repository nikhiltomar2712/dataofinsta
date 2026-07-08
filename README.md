# SecureVault

**SecureVault** is a modern password manager design featuring **zero-knowledge encryption** and **breach checking (HIBP k-anonymity)**. This repository page is also published as a GitHub Pages site.

GitHub repo: https://github.com/nikhiltomar2712/SecureVault

---

## What SecureVault does

- **Zero-knowledge vault**: your master password is **never stored**. All vault data is encrypted client-side.
- **Strong cryptography**:
  - Key derivation: **Argon2id** (`argon2-cffi`)
  - Encryption: **AES-256-GCM** (`cryptography`)
- **Breach checking**:
  - HIBP integration using **k-anonymity** (only SHA-1 prefixes are sent)
  - Local breach list fallback (optional)
- **CLI-first experience**:
  - Beautiful terminal UI with **Typer** + **Rich**
- Optional web UI (FastAPI + simple frontend) sharing the same encryption logic.

---

## Features (planned)

- Add / view / search / copy / edit / delete password entries
- Strong password generator (customizable)
- Breach check per password and overall warnings
- Export / import encrypted vault JSON
- Auto-lock after inactivity

---

## Security Notes

- Avoids printing/logging sensitive data.
- Uses secure defaults and authenticated encryption (AES-GCM).
- Uses k-anonymity for HIBP to reduce privacy leakage.

---

## GitHub Pages

This site is intended for the SecureVault landing page and documentation.

