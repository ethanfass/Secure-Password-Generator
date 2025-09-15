import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

export default function App() {
  const [words, setWords] = useState<string[]>([]);
  const [password, setPassword] = useState("");

  const [allowNumbers, setAllowNumbers] = useState(true);
  const [allowSymbols, setAllowSymbols] = useState(true);
  const [allowCapitals, setAllowCapitals] = useState(true);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? saved === "1" : false;
  });

  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const [history, setHistory] = useState<string[]>([]);
  const pushHistory = (pw: string) => setHistory((h) => [pw, ...h]);

  // Checklist popover state (no inline styles; CSS handles layout)
  const [showChecklist, setShowChecklist] = useState(false);
  const checkBtnRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/wordlistpw.txt")
      .then((res) => res.text())
      .then((text) => {
        const blacklist = [
          "autism","autistic","diabetes","epilepsy","epileptic",
          "dyslexia","dyslexic","deviant","deranged",
          "suicide","murder","rape",
          "caucasian","eskimo","badass","douche","dweeb",
        ];
        const list = text
          .split("\n")
          .map((line) => line.trim().split(/\s+/)[1])
          .filter(Boolean)
          .filter((w) => !blacklist.includes(w));
        setWords(list);
      });

    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", darkMode ? "1" : "0");
  }, [darkMode]);

  const letters = "abcdefghijklmnopqrstuvwxyz";
  const symbols = "!@#$%^&*()_+[]{}<>?-=";
  const rand = (n: number) => Math.floor(Math.random() * n);
  const randWord = () => words[rand(words.length)];
  const randLetter = () => letters[rand(letters.length)];
  const randSymbol = () => symbols[rand(symbols.length)];
  const randDigit = () => String(rand(10));
  const fill = (n: number, fn: () => string) => Array.from({ length: n }, fn).join("");

  function secureRandInt(n: number): number {
    if (n <= 0 || n > 256) throw new Error("n out of range");
    const buf = new Uint8Array(1);
    const max = 256 - (256 % n);
    while (true) {
      crypto.getRandomValues(buf);
      if (buf[0] < max) return buf[0] % n;
    }
  }

  function applyLeetRandom(input: string): string {
    const full: Record<string, string> = {
      a: "@", e: "3", i: "1", o: "0", s: "5", t: "7",
      l: "1", b: "8", z: "2", h: "#", x: "%", c: "(",
    };
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(full)) {
      const isDigit = /\d/.test(v);
      const isSymbol = /[^A-Za-z0-9]/.test(v);
      if ((isDigit && !allowNumbers) || (isSymbol && !allowSymbols)) continue;
      filtered[k] = v;
    }
    return input
      .split("")
      .map((ch) => {
        const repl = filtered[ch.toLowerCase()];
        return repl && Math.random() < 0.25 ? repl : ch;
      })
      .join("");
  }

  const COMMON_PHRASES = [
    "password","letmein","qwerty","admin","123456","iloveyou","welcome",
    "monkey","dragon"
  ];

  function detectCommonPhrase(pw: string): string | null {
    const lower = pw.toLowerCase();
    for (const phrase of COMMON_PHRASES) {
      if (lower.includes(phrase)) return phrase;
    }
    return null;
  }

  const log2 = (n: number) => Math.log(n) / Math.log(2);

  function hasSequentialRun(s: string, minLen = 4): boolean {
    let run = 1;
    for (let i = 0; i < s.length - 1; i++) {
      const a = s.charCodeAt(i);
      const b = s.charCodeAt(i + 1);
      const diff = b - a;
      if (diff === 1 || diff === -1) {
        run += 1;
        if (run >= minLen) return true;
      } else {
        run = 1;
      }
    }
    return false;
  }

  function scorePassword(pw: string) {
    if (!pw) return { score: 0, label: "Empty", band: "very-weak", common: null as string | null };

    const hasLower  = /[a-z]/.test(pw);
    const hasUpper  = /[A-Z]/.test(pw);
    const hasDigit  = /\d/.test(pw);
    const hasSymbol = /[^A-Za-z0-9]/.test(pw);
    const length    = pw.length;

    let alphabet = 0;
    if (hasLower)  alphabet += 26;
    if (hasUpper)  alphabet += 26;
    if (hasDigit)  alphabet += 10;
    if (hasSymbol) alphabet += symbols.length;

    if (alphabet === 0) alphabet = 1;

    const bits = length * log2(alphabet);
    let score = Math.min(100, Math.round((bits / 120) * 100));

    const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
    if (classes >= 3) score += 5;
    if (classes === 4) score += 10;

    if (length >= 14) score += 5;
    if (length >= 18) score += 5;

    const common = detectCommonPhrase(pw);
    if (common) score -= 40;
    if (/(.)\1{2,}/.test(pw)) score -= 10;
    if (/\d{4,}/.test(pw)) score -= 5;
    if (hasSequentialRun(pw, 4)) score -= 8;

    score = Math.max(0, Math.min(100, score));

    let label = "Weak", band = "weak";
    if (score < 30) { label = "Very Weak"; band = "very-weak"; }
    else if (score < 50) { label = "Weak"; band = "weak"; }
    else if (score < 70) { label = "Medium"; band = "medium"; }
    else if (score < 90) { label = "Strong"; band = "strong"; }
    else { label = "Very Strong"; band = "very-strong"; }

    return { score, label, band, common };
  }

  const strength = useMemo<ReturnType<typeof scorePassword>>(
    () => scorePassword(password),
    [password, allowNumbers, allowSymbols, allowCapitals]
  );

  // Checklist items (driven by password)
  const checklist = useMemo(() => {
    const pw = password || "";
    const hasLower  = /[a-z]/.test(pw);
    const hasUpper  = /[A-Z]/.test(pw);
    const hasDigit  = /\d/.test(pw);
    const hasSymbol = /[^A-Za-z0-9]/.test(pw);
    const length    = pw.length;

    let alphabet = 0;
    if (hasLower)  alphabet += 26;
    if (hasUpper)  alphabet += 26;
    if (hasDigit)  alphabet += 10;
    if (hasSymbol) alphabet += symbols.length;
    if (alphabet === 0) alphabet = 1;
    const bits = length * log2(alphabet);

    const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
    const commonPhrase = detectCommonPhrase(pw);
    const hasRepeat = /(.)\1{2,}/.test(pw);
    const hasSeq = hasSequentialRun(pw, 4);

    return [
      { label: "At least 12 characters", ok: length >= 12 },
      { label: "Contains lowercase (a–z)", ok: hasLower },
      { label: "Contains uppercase (A–Z)", ok: hasUpper },
      { label: "Contains a number (0–9)", ok: hasDigit },
      { label: "Contains a symbol (!@#$…)", ok: hasSymbol },
      { label: "No common phrases (e.g., “password”)", ok: !commonPhrase },
      { label: "No 3+ repeating characters (e.g., aaa)", ok: !hasRepeat },
      { label: "No 4+ sequential runs (abcd/4321)", ok: !hasSeq },
      { label: "Uses ≥ 3 character classes", ok: classes >= 3 },
      { label: "Estimated entropy ≥ 60 bits", ok: bits >= 60 },
    ] as { label: string; ok: boolean }[];
  }, [password]);

  function toggleChecklist() {
    setShowChecklist((s) => !s);
  }

  function generateSimplePassword() {
    if (words.length < 2) return;

    let w1 = randWord(), w2 = randWord();
    const cap = Math.floor(Math.random() * 4);
    const capWord = (w: string) =>
      allowCapitals ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase();
    if (cap === 1) w1 = capWord(w1);
    else if (cap === 2) w2 = capWord(w2);
    else if (cap === 3) { w1 = capWord(w1); w2 = capWord(w2); }

    let tail: string;
    if (allowNumbers) {
      tail = String(Math.floor(Math.random() * 90 + 10));
    } else if (allowSymbols) {
      tail = fill(2, randSymbol);
    } else {
      tail = fill(3, () => allowCapitals && Math.random() < 0.4
        ? randLetter().toUpperCase()
        : randLetter());
    }

    const end =
      allowSymbols ? randSymbol() :
      allowNumbers ? randDigit() :
      randLetter();

    const next = `${w1}${w2}${tail}${end}`;
    setPassword(next);
    pushHistory(next);
    setCopied(false);
  }

  function generateComplexPassword() {
    if (words.length < 2) return;

    let w1 = randWord(), w2 = randWord();
    const cap = Math.floor(Math.random() * 4);
    const capWord = (w: string) =>
      allowCapitals ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase();
    if (cap === 1) w1 = capWord(w1);
    else if (cap === 2) w2 = capWord(w2);
    else if (cap === 3) { w1 = capWord(w1); w2 = capWord(w2); }

    const slot = () =>
      allowSymbols ? randSymbol() :
      allowNumbers ? randDigit() :
      (allowCapitals && Math.random() < 0.4 ? randLetter().toUpperCase() : randLetter());

    const maybeOne =
      allowNumbers ? (Math.random() < 0.5 ? randDigit() : "") :
      allowSymbols ? (Math.random() < 0.5 ? randSymbol() : "") :
      "";

    const runLen = [2, 3, 4][rand(3)];
    const run =
      allowNumbers ? fill(runLen, randDigit) :
      allowSymbols ? fill(runLen + 1, randSymbol) :
      fill(runLen + 2, () => allowCapitals && Math.random() < 0.4
        ? randLetter().toUpperCase()
        : randLetter());

    const raw = `${w1}${slot()}${maybeOne}${w2}${slot()}${run}${slot()}`;
    const next = applyLeetRandom(raw);

    setPassword(next);
    pushHistory(next);
    setCopied(false);
  }

  function generateRandomPassword() {
    const lowers = "abcdefghijklmnopqrstuvwxyz";
    const uppers = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    const pool = lowers + uppers + digits + symbols;

    const length = 12 + secureRandInt(9);

    const chars: string[] = [];
    for (let i = 0; i < length; i++) {
      const idx = secureRandInt(pool.length);
      chars.push(pool[idx]);
    }
    const next = chars.join("");
    setPassword(next);
    pushHistory(next);
    setCopied(false);
  }

  async function copyToClipboard() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      const input = document.querySelector<HTMLInputElement>(".pw-text");
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
      }
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="container">
      <h1 className="app-title">Password Generator</h1>

      <button
        className="mode-toggle"
        onClick={() => setDarkMode((d) => !d)}
        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button>

      <div className="pw-row">
        <input
          className="pw-text"
          type="text"
          placeholder="Password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setCopied(false); }}
          aria-label="Generated password"
        />
        <button
          className="copy"
          onClick={copyToClipboard}
          disabled={!password}
          title={password ? "Copy password to clipboard" : "Generate or type a password first"}
        >
          Copy
        </button>
      </div>

      <div
        className="copy-status"
        aria-live="polite"
        role="status"
        style={{ minHeight: 20, marginTop: 6 }}
      >
        {copied ? "✅ Copied!" : ""}
      </div>

      <div className="meter">
        <div className={`meter-fill ${strength.band}`} style={{ width: `${strength.score}%` }} />
      </div>
      <div className="meter-text">{strength.label} ({strength.score})</div>

      {strength.common && (
        <div
          role="alert"
          aria-live="polite"
          className="common-warning"
        >
          ⚠️ Your password contains the common phrase “{strength.common}”. Please change it.
        </div>
      )}

      <div className="toggles">
        <label className="toggle">
          <input
            type="checkbox"
            checked={allowNumbers}
            onChange={(e) => setAllowNumbers(e.target.checked)}
          />
          <span className="slider" />
          <span className="label-text">Numbers</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={allowSymbols}
            onChange={(e) => setAllowSymbols(e.target.checked)}
          />
          <span className="slider" />
          <span className="label-text">Symbols</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={allowCapitals}
            onChange={(e) => setAllowCapitals(e.target.checked)}
          />
          <span className="slider" />
          <span className="label-text">Capitals</span>
        </label>
      </div>

      <div className="actions">
        <button className="simple" onClick={generateSimplePassword}>Simple Password</button>
        <button className="complex" onClick={generateComplexPassword}>Complex Password</button>
        <button className="random" onClick={generateRandomPassword}>Random Password</button>

        {/* Checklist trigger (no inline styles) */}
        <button
          className="checklist-btn"
          ref={checkBtnRef}
          onClick={toggleChecklist}
          title="Show password security checklist"
        >
          Check security
        </button>
      </div>

      {/* Checklist popover (CSS controls layout/position) */}
      {showChecklist && (
        <div
          ref={popoverRef}
          className="checklist-popover"
          role="dialog"
          aria-label="Password security checklist"
        >
          <div className="checklist-header">
            <strong>Password Checklist</strong>
          </div>

          <ul className="checklist-list" role="list">
            {checklist.map((item, i) => (
              <li className="checklist-item" key={i}>
                <span className="checklist-status" aria-hidden="true">
                  {item.ok ? "✅" : "⬜"}
                </span>
                <span className="checklist-label">{item.label}</span>
              </li>
            ))}
          </ul>

          <div className="checklist-tip">
            Tip: Aim to satisfy all items for strongest security.
          </div>
        </div>
      )}

      <div className="history-box">
        <div className="history-header">Recently Generated Passwords</div>

        {history.length === 0 ? (
          <div style={{ padding: 10, color: "#6b7280", fontStyle: "italic" }}>
            No passwords yet.
          </div>
        ) : (
          <ul className="history-list">
            {history.map((pw, idx) => (
              <li className="history-item" key={`${idx}-${pw}`}>{pw}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
