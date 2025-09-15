# Secure Password Generator

A React + TypeScript (Vite) app that creates strong, customizable passwords. Toggle symbols, numbers, capitalization, set length, copy to clipboard, view history, and switch dark mode.

---

## Features

- Toggles: Symbols, Numbers, Capital Letters
- One-click Copy with visual feedback
- History of recently generated passwords
- Dark Mode saved to localStorage
- Optional wordlist support (diceware-style)

## Tech Stack

- Frontend: React, TypeScript, Vite
- Styling: CSS (or your preferred framework)

# Setup

```bash
npm install
npm run dev
```

- Opens at http://localhost:5173

# Build
```bash
Copy code
npm run build
npm run preview
```

# Wordlist (optional)

- Place file at: public/wordlistpw.txt
- Loaded via: fetch("/wordlistpw.txt")
- Format: one word per line (or adjust your parser)

# Notes

- Don’t commit node_modules/ (use .gitignore)
- Security tip: avoid keeping real passwords in history beyond session needs
- Words are randomly selected form EFF diceware wordlist
- Certain vulgar words are blacklisted (ex: murder)
