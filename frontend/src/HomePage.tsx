import { useState, useMemo, useRef } from "react";
import { SignInButton, SignUpButton } from "@clerk/react";

export function HomePage() {
  // State for interactive hero preview simulator tabs
  const [heroTab, setHeroTab] = useState<"analytics" | "split" | "qr" | "currency">("analytics");
  const [analyticsCategory, setAnalyticsCategory] = useState<"all" | "food" | "housing" | "travel" | "entertainment">("all");
  const [copiedLink, setCopiedLink] = useState(false);

  // State for Comparison Table Slider & Switcher Mode
  const [comparisonView, setComparisonView] = useState<"splitwise" | "excel" | "all">("splitwise");
  const tableRef = useRef<HTMLDivElement>(null);

  const scrollTable = (direction: "left" | "right") => {
    if (tableRef.current) {
      const scrollAmount = direction === "left" ? -240 : 240;
      tableRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // State for Live Interactive Split Sandbox
  const [sandboxAmount, setSandboxAmount] = useState<number>(180);
  const [sandboxDesc, setSandboxDesc] = useState<string>("Weekend Cabin & Dinner");
  const [sandboxPayer, setSandboxPayer] = useState<string>("Priyank");
  const [sandboxMembers] = useState<string[]>(["Priyank", "Sarah", "Alex", "Marcus"]);

  // State for Live Currency Converter Simulation
  const [currAmount, setCurrAmount] = useState<number>(100);
  const [baseCurr, setBaseCurr] = useState<string>("USD");

  // State for FAQ accordion & category filter
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqCategory, setFaqCategory] = useState<"all" | "splitting" | "qr" | "security">("all");

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText("https://expezplit.pages.dev/?join=EURO-2026-X9");
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Live split calculations for the interactive sandbox
  const splitCalculations = useMemo(() => {
    const count = sandboxMembers.length;
    if (count === 0 || sandboxAmount <= 0) return { perPerson: 0, settlements: [] };

    const perPerson = Number((sandboxAmount / count).toFixed(2));
    const settlements = sandboxMembers
      .filter((m) => m !== sandboxPayer)
      .map((m) => ({
        from: m,
        to: sandboxPayer,
        amount: perPerson,
      }));

    return { perPerson, settlements };
  }, [sandboxAmount, sandboxPayer, sandboxMembers]);

  // Currency rate simulator multipliers
  const currencyRates: Record<string, { symbol: string; rate: number; label: string }> = {
    USD: { symbol: "$", rate: 1.0, label: "US Dollar" },
    EUR: { symbol: "€", rate: 0.92, label: "Euro" },
    INR: { symbol: "₹", rate: 86.5, label: "Indian Rupee" },
    GBP: { symbol: "£", rate: 0.79, label: "British Pound" },
    JPY: { symbol: "¥", rate: 154.2, label: "Japanese Yen" },
    CAD: { symbol: "CA$", rate: 1.36, label: "Canadian Dollar" },
    AED: { symbol: "AED", rate: 3.67, label: "UAE Dirham" },
  };

  const faqItems = [
    {
      category: "splitting",
      q: "Is Expezplit completely free to use?",
      a: "Yes! Expezplit is 100% free with no hidden paywalls, no monthly subscription fees, and no credit card required. You get unlimited personal expense logging, unlimited group split rooms, and unlimited CSV exports.",
    },
    {
      category: "qr",
      q: "How does the Instant QR Code Group Join work?",
      a: "When you create any group in Expezplit, a cryptographic QR code is generated instantly. Roommates or friends simply point their smartphone camera or Google Lens at the code to join the group in one tap without typing invitations or emails.",
    },
    {
      category: "splitting",
      q: "How does the Debt Minimization Algorithm work?",
      a: "Rather than making multiple messy payments among members (e.g. A owes B, B owes C, C owes A), our graph settlement algorithm calculates net balances and computes the absolute minimum number of direct transactions required to balance all accounts.",
    },
    {
      category: "security",
      q: "Is my financial information secure and private?",
      a: "Yes. Authentication is managed securely through Clerk with enterprise-grade encryption. All backend database operations are stored with PostgreSQL Row-Level Security via Supabase. We do not store sensitive bank login credentials.",
    },
    {
      category: "splitting",
      q: "Can we track expenses in multiple currencies during international travel?",
      a: "Absolutely! You can choose from over 200+ global fiat currencies when entering an expense. Expezplit automatically handles live currency conversion and presents normalized balances in the group's chosen base currency.",
    },
    {
      category: "qr",
      q: "Can I generate a personal payment QR code for settling debts?",
      a: "Yes! You can configure your UPI ID, PayPal username, or Revolut tag. Expezplit automatically generates a personalized Payment QR card so other members can scan and pay you immediately with zero friction.",
    },
  ];

  const filteredFaqs = faqCategory === "all" ? faqItems : faqItems.filter((f) => f.category === faqCategory);

  const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const navbarHeight = 84;
      const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: Math.max(0, elementPosition - navbarHeight),
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="lp-root" id="hero">
      {/* ── HERO SECTION ── */}
      <section className="lp-hero-fullscreen">
        <div className="lp-hero-ambient-glow" aria-hidden="true" />

        {/* <div className="lp-hero-live-badge">
          <span className="lp-badge-dot"></span>
          <span>SMART PERSONAL FINANCE & BILL SPLITTER</span>
          <span className="lp-badge-version">v2.4 PRO</span>
        </div> */}

        <h1 className="lp-hero-title">
          TRACK WITHOUT LIMITS.
          <br />
          <span className="lp-highlight-yellow">SPLIT-PERFECT.</span>
        </h1>

        <p className="lp-hero-subtitle">
          The high-precision finance platform built for individuals, roommates, travelers, and teams. Track daily spending with interactive Recharts analytics,
          condense complex group debts with smart minimization, and settle instantly with QR codes.
        </p>

        <div className="lp-hero-actions">
          <SignUpButton mode="modal">
            <button className="lp-btn lp-btn-yellow lp-btn-lg lp-glow-pulse">
              <span>GET STARTED FREE</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </SignUpButton>

          <button className="lp-btn lp-btn-outline lp-btn-lg" onClick={() => scrollToElement("calculator")}>
            <span>TEST LIVE SANDBOX</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* Hero Trust Badges */}
        <div className="lp-hero-trust-bar">
          <div className="lp-trust-item">
            <span className="lp-trust-stars">★★★★★</span>
            <span className="lp-trust-label">4.9 / 5 Rating</span>
          </div>
          <div className="lp-trust-divider" />
          <div className="lp-trust-item">
            <span className="lp-trust-icon"></span>
            <span className="lp-trust-label">100% Free Forever</span>
          </div>
          <div className="lp-trust-divider" />
          <div className="lp-trust-item">
            <span className="lp-trust-icon"></span>
            <span className="lp-trust-label">Supabase Realtime Sync</span>
          </div>
          <div className="lp-trust-divider" />
          <div className="lp-trust-item">
            <span className="lp-trust-icon"></span>
            <span className="lp-trust-label">200+ Global Currencies</span>
          </div>
        </div>
      </section>

      {/* ── HERO MOCKUP 4-IN-1 INTERACTIVE SIMULATOR SECTION ── */}
      <section className="lp-mockup-section" id="demo">
        <div className="lp-mockup-frame">
          <div className="lp-mockup-header">
            <div className="lp-window-dots">
              <span className="dot dot-red"></span>
              <span className="dot dot-yellow"></span>
              <span className="dot dot-green"></span>
            </div>
            <div className="lp-mockup-title">
              <span className="lp-console-prompt">$</span> expezplit//engine
            </div>
            <div className="lp-mockup-tabs">
              <button
                className={`lp-mockup-tab ${heroTab === "analytics" ? "active" : ""}`}
                onClick={() => setHeroTab("analytics")}
              >
                <span>Analytics View</span>
              </button>
              <button
                className={`lp-mockup-tab ${heroTab === "split" ? "active" : ""}`}
                onClick={() => setHeroTab("split")}
              >
                <span>Group Splitwise</span>
              </button>
              <button
                className={`lp-mockup-tab ${heroTab === "qr" ? "active" : ""}`}
                onClick={() => setHeroTab("qr")}
              >
                <span>QR Pay & Settle</span>
              </button>
              <button
                className={`lp-mockup-tab ${heroTab === "currency" ? "active" : ""}`}
                onClick={() => setHeroTab("currency")}
              >
                <span>Multi-Currency</span>
              </button>
            </div>
          </div>

          <div className="lp-mockup-body">
            {/* TAB 1: ANALYTICS PREVIEW */}
            {heroTab === "analytics" && (
              <div className="lp-preview-content">
                <div className="lp-analytics-filter-row">
                  <span className="lp-filter-label">Filter Category:</span>
                  {(["all", "food", "housing", "travel", "entertainment"] as const).map((cat) => (
                    <button
                      key={cat}
                      className={`lp-filter-chip ${analyticsCategory === cat ? "active" : ""}`}
                      onClick={() => setAnalyticsCategory(cat)}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="lp-preview-grid-3">
                  <div className="lp-preview-card">
                    <div className="lp-preview-label">TOTAL SPENT (THIS MONTH)</div>
                    <div className="lp-preview-val">
                      {analyticsCategory === "food" ? "$940.00" : analyticsCategory === "housing" ? "$1,250.00" : analyticsCategory === "travel" ? "$480.50" : analyticsCategory === "entertainment" ? "$175.00" : "$2,845.50"}
                    </div>
                    <div className="lp-preview-change positive">↓ 14% vs last month</div>
                  </div>
                  <div className="lp-preview-card">
                    <div className="lp-preview-label">YOU ARE OWED</div>
                    <div className="lp-preview-val lp-text-yellow">$420.00</div>
                    <div className="lp-preview-change">3 active group debts</div>
                  </div>
                  <div className="lp-preview-card">
                    <div className="lp-preview-label">YOU OWE</div>
                    <div className="lp-preview-val">$45.00</div>
                    <div className="lp-preview-change">1 pending settlement</div>
                  </div>
                </div>

                {/* Simulated Chart preview */}
                <div className="lp-simulated-chart-container">
                  <div className="lp-chart-header">
                    <div>
                      <span className="lp-chart-title">SPENDING DYNAMICS & RECHARTS BREAKDOWN</span>
                      <span className="lp-chart-sub">Category: {analyticsCategory.toUpperCase()} • Daily View</span>
                    </div>
                    <span className="lp-chart-badge">LIVE RECHARTS ENGINE</span>
                  </div>
                  <div className="lp-simulated-bars">
                    <div className="lp-bar-col">
                      <div className="lp-bar" style={{ height: analyticsCategory === "food" ? "75%" : "45%" }}>
                        <span className="lp-bar-tooltip">$65</span>
                      </div>
                      <span>MON</span>
                    </div>
                    <div className="lp-bar-col">
                      <div className="lp-bar" style={{ height: analyticsCategory === "travel" ? "80%" : "68%" }}>
                        <span className="lp-bar-tooltip">$98</span>
                      </div>
                      <span>TUE</span>
                    </div>
                    <div className="lp-bar-col">
                      <div className="lp-bar" style={{ height: analyticsCategory === "housing" ? "90%" : "35%" }}>
                        <span className="lp-bar-tooltip">$52</span>
                      </div>
                      <span>WED</span>
                    </div>
                    <div className="lp-bar-col">
                      <div className="lp-bar yellow-accent" style={{ height: "95%" }}>
                        <span className="lp-bar-tooltip">$140 (Peak)</span>
                      </div>
                      <span>THU</span>
                    </div>
                    <div className="lp-bar-col">
                      <div className="lp-bar" style={{ height: analyticsCategory === "entertainment" ? "85%" : "62%" }}>
                        <span className="lp-bar-tooltip">$88</span>
                      </div>
                      <span>FRI</span>
                    </div>
                    <div className="lp-bar-col">
                      <div className="lp-bar yellow-accent" style={{ height: "88%" }}>
                        <span className="lp-bar-tooltip">$124</span>
                      </div>
                      <span>SAT</span>
                    </div>
                    <div className="lp-bar-col">
                      <div className="lp-bar" style={{ height: "50%" }}>
                        <span className="lp-bar-tooltip">$72</span>
                      </div>
                      <span>SUN</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GROUP SPLITWISE PREVIEW */}
            {heroTab === "split" && (
              <div className="lp-preview-content">
                <div className="lp-split-header">
                  <div>
                    <span className="lp-group-name">Summer EuroTrip 2026</span>
                    <span className="lp-group-meta">4 Members • Currency: USD ($) • 6 Total Bills</span>
                  </div>
                  <span className="lp-chip lp-chip-yellow">DEBT MINIMIZED (2 TRANSACTIONS)</span>
                </div>

                <div className="lp-ledger-list">
                  <div className="lp-ledger-item">
                    <div className="lp-user-avatar">AM</div>
                    <div className="lp-ledger-info">
                      <div className="lp-user-name">Alex Miller paid for Airbnb Villa (3 Nights)</div>
                      <div className="lp-ledger-sub">Total $840.00 • Split equally among 4</div>
                    </div>
                    <div className="lp-ledger-balance lp-text-green">+ $630.00</div>
                  </div>

                  <div className="lp-ledger-item">
                    <div className="lp-user-avatar yellow-bg">YOU</div>
                    <div className="lp-ledger-info">
                      <div className="lp-user-name">You paid for Team Dinner & Seafood</div>
                      <div className="lp-ledger-sub">Total $240.00 • Split equally among 4</div>
                    </div>
                    <div className="lp-ledger-balance lp-text-yellow">+ $180.00</div>
                  </div>

                  <div className="lp-settle-box">
                    <div className="lp-settle-title">
                      <span>MINIMIZED OPTIMAL SETTLEMENT PATHS</span>
                      <span className="lp-settle-tag">ZERO CIRCULAR DEBT</span>
                    </div>
                    <div className="lp-settle-row">
                      <div className="lp-settle-from-to">
                        <span className="lp-pill-avatar">SJ</span> Sarah Jenkins ➔ <span className="lp-pill-avatar">AM</span> Alex Miller
                      </div>
                      <strong className="lp-text-yellow">$210.00</strong>
                    </div>
                    <div className="lp-settle-row">
                      <div className="lp-settle-from-to">
                        <span className="lp-pill-avatar">MC</span> Marcus Chen ➔ <span className="lp-pill-avatar yellow">YOU</span> You
                      </div>
                      <strong className="lp-text-yellow">$180.00</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: QR CODE PREVIEW */}
            {heroTab === "qr" && (
              <div className="lp-preview-content lp-qr-preview">
                <div className="lp-qr-box">
                  <div className="lp-qr-code-dummy">
                    <svg viewBox="0 0 100 100" width="130" height="130" className="lp-qr-svg">
                      <rect width="100" height="100" fill="#0E0E12" rx="8" />
                      <path d="M10 10h30v30h-30zM60 10h30v30h-30zM10 60h30v30h-30z" fill="#FDE406" />
                      <path d="M16 16h18v18h-18zM66 16h18v18h-18zM16 66h18v18h-18z" fill="#0E0E12" />
                      <path d="M21 21h8v8h-8zM71 21h8v8h-8zM21 71h8v8h-8z" fill="#FDE406" />
                      <rect x="46" y="10" width="8" height="38" fill="#FDE406" />
                      <rect x="10" y="46" width="38" height="8" fill="#FDE406" />
                      <rect x="56" y="56" width="12" height="12" fill="#FDE406" />
                      <rect x="76" y="76" width="14" height="14" fill="#FDE406" />
                      <rect x="56" y="76" width="12" height="14" fill="#FFFFFF" />
                      <rect x="76" y="56" width="14" height="12" fill="#FDE406" />
                    </svg>
                  </div>
                  <div className="lp-qr-details">
                    <div className="lp-qr-tag">// SCAN VIA SMARTPHONE CAMERA</div>
                    <h3>Group Instant QR Join & Payment Card</h3>
                    <p>Scan with Google Lens or iPhone Camera to auto-join group <strong>"EuroTrip 2026"</strong> with zero typing.</p>
                    <div className="lp-qr-actions">
                      <button className="lp-btn lp-btn-yellow-sm" onClick={() => alert("Simulated: High-Res QR Code PNG Downloaded!")}>
                        <span>DOWNLOAD QR</span>
                      </button>
                      <button className="lp-btn lp-btn-outline-sm" onClick={handleCopyLink}>
                        <span>{copiedLink ? "✓ LINK COPIED!" : "COPY ROOM LINK"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MULTI-CURRENCY PREVIEW */}
            {heroTab === "currency" && (
              <div className="lp-preview-content">
                <div className="lp-currency-simulator">
                  <div className="lp-currency-header">
                    <h3>Realtime 200+ Global Currency Converter</h3>
                    <p>Test real-time fiat rates calculated across your group expenses.</p>
                  </div>

                  <div className="lp-currency-input-row">
                    <div className="lp-input-group">
                      <label>Amount</label>
                      <input
                        type="number"
                        min="1"
                        value={currAmount}
                        onChange={(e) => setCurrAmount(Number(e.target.value) || 0)}
                        className="lp-curr-input"
                      />
                    </div>
                    <div className="lp-input-group">
                      <label>Base Currency</label>
                      <select
                        value={baseCurr}
                        onChange={(e) => setBaseCurr(e.target.value)}
                        className="lp-curr-select"
                      >
                        {Object.keys(currencyRates).map((curr) => (
                          <option key={curr} value={curr}>
                            {curr} - {currencyRates[curr].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="lp-currency-grid">
                    {Object.entries(currencyRates)
                      .filter(([curr]) => curr !== baseCurr)
                      .map(([curr, info]) => {
                        const baseMultiplier = currencyRates[baseCurr].rate;
                        const converted = ((currAmount / baseMultiplier) * info.rate).toFixed(2);
                        return (
                          <div className="lp-curr-card" key={curr}>
                            <span className="lp-curr-badge">{curr}</span>
                            <span className="lp-curr-value">{info.symbol} {converted}</span>
                            <span className="lp-curr-name">{info.label}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── TICKER STRIP ── */}
      <section className="lp-ticker-section">
        <div className="lp-ticker-track">
          <div className="lp-ticker-item">• RECHARTS DATA VISUALIZATION</div>
          <div className="lp-ticker-item">• CLERK ENTERPRISE AUTHENTICATION</div>
          <div className="lp-ticker-item">• SUPABASE REALTIME POSTGRESQL</div>
          <div className="lp-ticker-item">• 200+ LIVE GLOBAL CURRENCIES</div>
          <div className="lp-ticker-item">• IN-APP CAMERA QR SCANNER</div>
          <div className="lp-ticker-item">• AUTOMATED NODEMAILER REMINDERS</div>
          <div className="lp-ticker-item">• 1-CLICK CSV DATA EXPORT</div>
          <div className="lp-ticker-item">• DEBT MINIMIZATION GRAPH ALGORITHM</div>
        </div>
      </section>

      {/* ── SECTION 1: CORE CAPABILITIES (6 PILLARS) ── */}
      <section className="lp-section" id="features">
        <div className="lp-section-header">
          <div className="lp-section-tag">// CORE CAPABILITIES</div>
          <h2 className="lp-section-title">EVERYTHING YOU NEED. ZERO EXPENSE NOISE.</h2>
          <p className="lp-section-desc">Designed with high-density focus for individuals, flatmates, and travel groups who demand absolute precision in money management.</p>
        </div>

        <div className="lp-cards-grid-3">
          <div className="lp-feature-card lp-card-yellow-border">
            <div className="lp-card-header">
              <span className="lp-card-num">01</span>
              <span className="lp-card-pill pill-yellow">ANALYTICS</span>
            </div>
            <h3>EXPENSE LOGGING & TRENDS</h3>
            <p>
              Log expenses with automatic timestamping, category tags, and real-time interactive Recharts area graphs. Filter by month, year, or custom range with zero latency.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-yellow">Dynamic Visual Reports →</span>
            </div>
          </div>

          <div className="lp-feature-card lp-card-orange-border">
            <div className="lp-card-header">
              <span className="lp-card-num">02</span>
              <span className="lp-card-pill pill-orange">SPLITWISE</span>
            </div>
            <h3>FAIR GROUP BILL SPLITTING</h3>
            <p>
              Create dynamic groups for trips, rent, or dinner. Split costs equally or with custom percentage shares. Our algorithm automatically eliminates circular debt.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-orange">Smart Debt Minimization →</span>
            </div>
          </div>

          <div className="lp-feature-card lp-card-cyan-border">
            <div className="lp-card-header">
              <span className="lp-card-num">03</span>
              <span className="lp-card-pill pill-cyan">QR CODES</span>
            </div>
            <h3>INSTANT QR PAYMENTS & JOIN</h3>
            <p>
              Join groups in 1-second by scanning QR codes. Generate personalized payment QR codes so friends can settle debts immediately without entering bank details.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-cyan">Seamless Camera Scan →</span>
            </div>
          </div>

          <div className="lp-feature-card lp-card-green-border">
            <div className="lp-card-header">
              <span className="lp-card-num">04</span>
              <span className="lp-card-pill pill-green">CURRENCIES</span>
            </div>
            <h3>200+ MULTI-CURRENCY CONVERSION</h3>
            <p>
              Traversing borders? Log expenses in any global currency (EUR, USD, INR, GBP, JPY) with real-time conversion rates normalized to your group base currency.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-green">Live Exchange Rates →</span>
            </div>
          </div>

          <div className="lp-feature-card lp-card-purple-border">
            <div className="lp-card-header">
              <span className="lp-card-num">05</span>
              <span className="lp-card-pill pill-purple">NOTIFICATIONS</span>
            </div>
            <h3>AUTOMATED EMAIL DEBT REMINDERS</h3>
            <p>
              Politely remind group members of pending balances with one-click automated Nodemailer email notices containing detailed itemized breakdowns.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-purple">Zero Social Awkwardness →</span>
            </div>
          </div>

          <div className="lp-feature-card lp-card-rose-border">
            <div className="lp-card-header">
              <span className="lp-card-num">06</span>
              <span className="lp-card-pill pill-rose">EXPORT</span>
            </div>
            <h3>1-CLICK CSV AUDIT LOGS</h3>
            <p>
              Download comprehensive expense histories and group audit logs into clean formatted CSV files ready for Microsoft Excel, Google Sheets, or tax filing.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-rose">100% Data Sovereignty →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LIVE INTERACTIVE SPLIT CALCULATOR SANDBOX ── */}
      <section className="lp-section lp-sandbox-section" id="calculator">
        <div className="lp-section-header">
          <div className="lp-section-tag">// LIVE SANDBOX CALCULATOR</div>
          <h2 className="lp-section-title">TEST THE SMART SPLIT ENGINE LIVE</h2>
          <p className="lp-section-desc">Try our debt minimization algorithm right now. Adjust bill details and watch how messy split balances get simplified instantly.</p>
        </div>

        <div className="lp-calculator-container">
          <div className="lp-calc-inputs">
            <div className="lp-calc-card">
              <div className="lp-calc-card-title">1. EXPENSE PARAMETERS</div>

              <div className="lp-calc-form-group">
                <label>Expense Description</label>
                <input
                  type="text"
                  value={sandboxDesc}
                  onChange={(e) => setSandboxDesc(e.target.value)}
                  className="lp-calc-input"
                  placeholder="e.g. Airbnb Apartment, Dinner"
                />
              </div>

              <div className="lp-calc-form-group">
                <label>Total Amount ($ USD)</label>
                <div className="lp-amount-input-wrap">
                  <span className="lp-curr-sym">$</span>
                  <input
                    type="number"
                    min="1"
                    value={sandboxAmount}
                    onChange={(e) => setSandboxAmount(Math.max(1, Number(e.target.value) || 0))}
                    className="lp-calc-input lp-amount-field"
                  />
                </div>
              </div>

              <div className="lp-calc-form-group">
                <label>Who Paid?</label>
                <div className="lp-payer-pills">
                  {sandboxMembers.map((m) => (
                    <button
                      key={m}
                      className={`lp-payer-pill ${sandboxPayer === m ? "active" : ""}`}
                      onClick={() => setSandboxPayer(m)}
                    >
                      {m} {sandboxPayer === m ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lp-calc-form-group">
                <label>Group Members ({sandboxMembers.length})</label>
                <div className="lp-members-list">
                  {sandboxMembers.map((m) => (
                    <span key={m} className="lp-member-tag">
                      <span className="lp-member-tag-dot" />
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lp-calc-results">
            <div className="lp-calc-card lp-calc-results-card">
              <div className="lp-calc-card-title">
                <span>2. LIVE SETTLEMENT GRAPH</span>
                <span className="lp-calc-live-badge">OPTIMIZED</span>
              </div>

              <div className="lp-calc-summary-stat">
                <div>
                  <span className="lp-stat-lbl">PER PERSON SHARE</span>
                  <span className="lp-stat-val lp-text-yellow">${splitCalculations.perPerson.toFixed(2)}</span>
                </div>
                <div className="lp-stat-right">
                  <span className="lp-stat-lbl">PAID BY</span>
                  <span className="lp-stat-val lp-text-green">{sandboxPayer}</span>
                </div>
              </div>

              <div className="lp-calc-settlement-list">
                <span className="lp-settlement-header">Direct Minimization Routes:</span>
                {splitCalculations.settlements.map((s, idx) => (
                  <div key={idx} className="lp-calc-settle-item">
                    <div className="lp-calc-user-flow">
                      <strong>{s.from}</strong>
                      <span className="lp-flow-arrow">➔ owes ➔</span>
                      <strong>{s.to}</strong>
                    </div>
                    <span className="lp-calc-amount lp-text-yellow">${s.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: WORKFLOW (3 STEPS) ── */}
      <section className="lp-section" id="workflow">
        <div className="lp-section-header">
          <div className="lp-section-tag">// THE WORKFLOW</div>
          <h2 className="lp-section-title">THREE STEPS. ZERO EXPENSE DRAMA.</h2>
          <p className="lp-section-desc">From creating a group to final 1-click debt settlement, Expezplit streamlines money tracking with zero hassle.</p>
        </div>

        <div className="lp-steps-grid">
          <div className="lp-step-card">
            <div className="lp-step-huge-num">01</div>
            <h4>CREATE & INVITE VIA QR</h4>
            <p>
              Set up a group room in 5 seconds. Display your group QR code for friends to scan with any smartphone camera and join automatically.
            </p>
          </div>

          <div className="lp-step-card">
            <div className="lp-step-huge-num">02</div>
            <h4>LOG & AUTO-CONVERT</h4>
            <p>
              Record dinner bills, Airbnb rent, or vacation expenses in 200+ global currencies. Expezplit auto-converts exchange rates on the fly.
            </p>
          </div>

          <div className="lp-step-card">
            <div className="lp-step-huge-num">03</div>
            <h4>SETTLE IN 1-CLICK</h4>
            <p>
              View live balance calculations. Send automated Nodemailer email reminders or scan personal payment QR codes to settle debts instantly.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: LIVE STATS BANNER ── */}
      <section className="lp-stats-banner" id="stats">
        <div className="lp-stats-container">
          <div className="lp-stat-block">
            <div className="lp-stat-val">$2.8M+</div>
            <div className="lp-stat-lbl">TOTAL EXPENSES TRACKED</div>
          </div>
          <div className="lp-stat-block">
            <div className="lp-stat-val">45,000+</div>
            <div className="lp-stat-lbl">GROUP DEBTS SETTLED</div>
          </div>
          <div className="lp-stat-block">
            <div className="lp-stat-val">200+</div>
            <div className="lp-stat-lbl">GLOBAL FIAT CURRENCIES</div>
          </div>
          <div className="lp-stat-block">
            <div className="lp-stat-val">99.9%</div>
            <div className="lp-stat-lbl">DISPUTE-FREE RECORD</div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: BENTO BOX SYSTEM MATRIX ── */}
      <section className="lp-section" id="matrix">
        <div className="lp-section-header">
          <div className="lp-section-tag">// SYSTEM MATRIX</div>
          <h2 className="lp-section-title">ENGINEERED FOR TOTAL FINANCIAL CLARITY</h2>
          <p className="lp-section-desc">A comprehensive suite of financial microservices built for performance, privacy, and frictionless daily usage.</p>
        </div>

        <div className="lp-bento-grid">
          <div className="lp-bento-card bento-yellow">
            <div className="lp-bento-tag">// CORE ENGINE</div>
            <h3>SMART EXPENSE COMPANION</h3>
            <p>
              Granular expense logging with instant category tags, date filtering, monthly comparisons, and real-time Recharts interactive graphs.
            </p>
            <div className="lp-bento-badge">SYSTEM CORE</div>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// ALGORITHM</div>
            <h3>DEBT MINIMIZER</h3>
            <p>Calculates the absolute minimum number of payments required between group members, eliminating messy circular IOUs.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// ENGINE</div>
            <h3>MULTI-CURRENCY</h3>
            <p>Auto-fetches real-time exchange rates across 200+ fiat currencies globally for frictionless international travel.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// NOTIFICATIONS</div>
            <h3>EMAIL REMINDERS</h3>
            <p>Automated Node.js & Nodemailer alerts sent directly to members with due balances and itemized summaries.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// HARDWARE</div>
            <h3>IN-APP CAMERA QR</h3>
            <p>Scan payment QR codes and group invite tokens directly inside the browser using modern html5-qrcode technology.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// EXPORT</div>
            <h3>1-CLICK CSV AUDIT</h3>
            <p>Download complete expense logs, member splits, and transaction history formatted cleanly for Excel or Google Sheets.</p>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: COMPARISON MATRIX TABLE ── */}
      <section className="lp-section" id="comparison">
        <div className="lp-section-header">
          <div className="lp-section-tag">// FEATURE COMPARISON</div>
          <h2 className="lp-section-title">WHY USERS SWITCH TO EXPEZPLIT</h2>
          <p className="lp-section-desc">See how Expezplit outperforms traditional spreadsheets and legacy expense splitting apps.</p>
        </div>

        {/* Interactive Segmented Switcher & Slider Controls */}
        <div className="lp-comparison-controls">
          <div className="lp-comparison-tabs">
            <button
              className={`lp-comp-tab ${comparisonView === "splitwise" ? "active" : ""}`}
              onClick={() => setComparisonView("splitwise")}
            >
              <span>vs Splitwise</span>
            </button>
            <button
              className={`lp-comp-tab ${comparisonView === "excel" ? "active" : ""}`}
              onClick={() => setComparisonView("excel")}
            >
              <span>vs Excel</span>
            </button>
            <button
              className={`lp-comp-tab ${comparisonView === "all" ? "active" : ""}`}
              onClick={() => setComparisonView("all")}
            >
              <span>View All Columns</span>
            </button>
          </div>
        </div>

        <div className="lp-table-wrapper" ref={tableRef}>
          <table className="lp-matrix-table">
            <thead>
              <tr>
                <th>FEATURE CAPABILITY</th>
                <th className="lp-th-highlight">EXPEZPLIT PRO</th>
                {(comparisonView === "all" || comparisonView === "excel") && <th>EXCEL / GOOGLE SHEETS</th>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <th>BASIC SPLITWISE</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="lp-feature-title">100% Free & Unlimited Usage</td>
                <td className="lp-td-highlight">✓ YES (Always Free)</td>
                {(comparisonView === "all" || comparisonView === "excel") && <td>✓ Free</td>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <td className="lp-td-negative">✗ Paid Limits / Paywalls</td>}
              </tr>
              <tr>
                <td className="lp-feature-title">Instant QR Code Group Join</td>
                <td className="lp-td-highlight">✓ YES (1-Sec Camera Scan)</td>
                {(comparisonView === "all" || comparisonView === "excel") && <td className="lp-td-negative">✗ NO</td>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <td className="lp-td-negative">✗ NO (Email Invite Only)</td>}
              </tr>
              <tr>
                <td className="lp-feature-title">Multi-Currency Auto Conversion (200+)</td>
                <td className="lp-td-highlight">✓ YES (Live Rates Built-in)</td>
                {(comparisonView === "all" || comparisonView === "excel") && <td className="lp-td-negative">✗ Complex Formulas</td>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <td className="lp-td-negative">✗ Paid Tier Feature</td>}
              </tr>
              <tr>
                <td className="lp-feature-title">Smart Debt Minimization Graph</td>
                <td className="lp-td-highlight">✓ YES (Automated)</td>
                {(comparisonView === "all" || comparisonView === "excel") && <td className="lp-td-negative">✗ NO</td>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <td>✓ Partial</td>}
              </tr>
              <tr>
                <td className="lp-feature-title">Automated Nodemailer Email Alerts</td>
                <td className="lp-td-highlight">✓ YES (1-Click Notification)</td>
                {(comparisonView === "all" || comparisonView === "excel") && <td className="lp-td-negative">✗ NO</td>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <td className="lp-td-negative">✗ Manual Texting</td>}
              </tr>
              <tr>
                <td className="lp-feature-title">Interactive Recharts Visualizer</td>
                <td className="lp-td-highlight">✓ YES (Real-time Area & Bar)</td>
                {(comparisonView === "all" || comparisonView === "excel") && <td className="lp-td-negative">✗ Static Charts</td>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <td className="lp-td-negative">✗ Basic / Limited</td>}
              </tr>
              <tr>
                <td className="lp-feature-title">In-App Web Camera QR Reader</td>
                <td className="lp-td-highlight">✓ YES (Built-in)</td>
                {(comparisonView === "all" || comparisonView === "excel") && <td className="lp-td-negative">✗ NO</td>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <td className="lp-td-negative">✗ NO</td>}
              </tr>
              <tr>
                <td className="lp-feature-title">Full CSV Audit Data Export</td>
                <td className="lp-td-highlight">✓ YES (1-Click Instant)</td>
                {(comparisonView === "all" || comparisonView === "excel") && <td>✓ Native</td>}
                {(comparisonView === "all" || comparisonView === "splitwise") && <td className="lp-td-negative">✗ Gated behind Paywall</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── SECTION 7: USER TESTIMONIALS (WALL OF LOVE) ── */}
      <section className="lp-section" id="testimonials">
        <div className="lp-section-header">
          <div className="lp-section-tag">// USER TESTIMONIALS</div>
          <h2 className="lp-section-title">LOVED BY TRAVELERS & FLATMATES</h2>
          <p className="lp-section-desc">Here is why thousands of users trust Expezplit to organize their personal and group finances.</p>
        </div>

        <div className="lp-reviews-grid">
          <div className="lp-review-card">
            <div className="lp-review-stars">★★★★★</div>
            <p className="lp-review-quote">
              "The QR code group join saved our Euro trip! 5 of us joined the group in 10 seconds at the airport without typing long emails. The debt minimizer is pure magic."
            </p>
            <div className="lp-review-author">
              <div className="lp-author-avatar">AS</div>
              <div>
                <div className="lp-author-name">Ansh Soni</div>
                <div className="lp-author-role">Software Engineer • Ahmedabad</div>
              </div>
            </div>
          </div>

          <div className="lp-review-card lp-review-featured">
            <div className="lp-review-stars">★★★★★</div>
            <p className="lp-review-quote">
              "Managing flat rent, grocery runs, and utility bills used to be a weekly headache. Expezplit gives us instant clarity and 1-click email reminders."
            </p>
            <div className="lp-review-author">
              <div className="lp-author-avatar yellow-bg">PP</div>
              <div>
                <div className="lp-author-name">Patel Prince</div>
                <div className="lp-author-role">System Design Engineer • Ahmedabad</div>
              </div>
            </div>
          </div>

          <div className="lp-review-card">
            <div className="lp-review-stars">★★★★★</div>
            <p className="lp-review-quote">
              "The Recharts category analytics is cleaner than my paid banking app. Being able to log expenses in Yen and Euro with live rate conversions is unbelievable."
            </p>
            <div className="lp-review-author">
              <div className="lp-author-avatar">YP</div>
              <div>
                <div className="lp-author-name">Yug Patel</div>
                <div className="lp-author-role">Full Stack Developer • Gandhinagar</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: FAQ ACCORDION ── */}
      <section className="lp-section" id="faq">
        <div className="lp-section-header">
          <div className="lp-section-tag">// FREQUENTLY ASKED QUESTIONS</div>
          <h2 className="lp-section-title">EVERYTHING YOU NEED TO KNOW</h2>
          <p className="lp-section-desc">Got questions about how Expezplit works? Explore answers below.</p>
        </div>

        <div className="lp-faq-filter-row">
          {(["all", "splitting", "qr", "security"] as const).map((cat) => (
            <button
              key={cat}
              className={`lp-faq-filter-btn ${faqCategory === cat ? "active" : ""}`}
              onClick={() => setFaqCategory(cat)}
            >
              {cat === "all" ? "ALL QUESTIONS" : cat === "splitting" ? "BILL SPLITTING" : cat === "qr" ? "QR & PAYMENTS" : "SECURITY & DATA"}
            </button>
          ))}
        </div>

        <div className="lp-faq-container">
          {filteredFaqs.map((item, idx) => (
            <div
              key={idx}
              className={`lp-faq-item ${openFaq === idx ? "open" : ""}`}
              onClick={() => toggleFaq(idx)}
            >
              <div className="lp-faq-question">
                <span>{item.q}</span>
                <span className="lp-faq-icon">{openFaq === idx ? "−" : "+"}</span>
              </div>
              {openFaq === idx && (
                <div className="lp-faq-answer">
                  <p>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 9: PRICING SECTION ── */}
      <section className="lp-section" id="pricing">
        <div className="lp-section-header">
          <div className="lp-section-tag">// ACCESS PLANS</div>
          <h2 className="lp-section-title">TRANSPARENT PRICING. ZERO SURPRISES.</h2>
          <p className="lp-section-desc">Pick the plan that fits your personal budget and group expense needs.</p>
        </div>

        <div className="lp-pricing-grid">
          {/* Plan 1 */}
          <div className="lp-pricing-card">
            <div className="lp-pricing-plan-name">STARTER</div>
            <div className="lp-pricing-price">$0 <span>/ mo</span></div>
            <p className="lp-pricing-desc">Perfect for individual expense tracking and basic budgeting.</p>
            <div className="lp-pricing-features">
              <div className="lp-pricing-item">✓ Personal Expense Tracker</div>
              <div className="lp-pricing-item">✓ Category Pie & Area Charts</div>
              <div className="lp-pricing-item">✓ Up to 3 Active Groups</div>
              <div className="lp-pricing-item">✓ 1-Click CSV Data Export</div>
            </div>
            <SignUpButton mode="modal">
              <button className="lp-btn lp-btn-outline-sm w-full">GET STARTER FREE</button>
            </SignUpButton>
          </div>

          {/* Plan 2: FEATURED PRO PLAN IN YELLOW */}
          <div className="lp-pricing-card lp-pricing-featured">
            <div className="lp-pricing-featured-badge">[ MOST POPULAR • 100% FREE ]</div>
            <div className="lp-pricing-plan-name lp-text-yellow">PRO UNLIMITED</div>
            <div className="lp-pricing-price">$0 <span>/ FOREVER</span></div>
            <p className="lp-pricing-desc">Full access to every single feature with zero limits or paywalls.</p>
            <div className="lp-pricing-features">
              <div className="lp-pricing-item">✓ Unlimited Personal Expenses</div>
              <div className="lp-pricing-item">✓ Unlimited Groups & Roommates</div>
              <div className="lp-pricing-item">✓ Recharts Interactive Graphs</div>
              <div className="lp-pricing-item">✓ 200+ Multi-Currency Conversion</div>
              <div className="lp-pricing-item">✓ Instant QR Code Scan-To-Join</div>
              <div className="lp-pricing-item">✓ In-App Payment QR Generator</div>
              <div className="lp-pricing-item">✓ Automated Email Debt Alerts</div>
              <div className="lp-pricing-item">✓ Unlimited CSV Audit Exports</div>
            </div>
            <SignUpButton mode="modal">
              <button className="lp-btn lp-btn-yellow w-full">START FREE NOW →</button>
            </SignUpButton>
          </div>

          {/* Plan 3 */}
          <div className="lp-pricing-card">
            <div className="lp-pricing-plan-name">OPEN SOURCE</div>
            <div className="lp-pricing-price">COMMUNITY</div>
            <p className="lp-pricing-desc">For developers, custom deployments, and self-hosted environments.</p>
            <div className="lp-pricing-features">
              <div className="lp-pricing-item">✓ Everything in Pro Unlimited</div>
              <div className="lp-pricing-item">✓ Custom Supabase Schema Access</div>
              <div className="lp-pricing-item">✓ Dedicated Nodemailer SMTP Server</div>
              <div className="lp-pricing-item">✓ Full GitHub Source Code</div>
            </div>
            <a
              href="https://github.com/Patel-Priyank-1602/Expezplit"
              target="_blank"
              rel="noreferrer"
              className="lp-btn lp-btn-outline-sm w-full lp-text-center"
            >
              VIEW ON GITHUB
            </a>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: CTA BANNER ── */}
      <section className="lp-cta-section">
        <div className="lp-cta-box">
          <div className="lp-cta-tag">// START TRACKING NOW</div>
          <h2>READY TO ELIMINATE EXPENSE DRAMA?</h2>
          <p>Join thousands of users who track daily spending and split group bills effortlessly.</p>
          <div className="lp-cta-buttons">
            <SignUpButton mode="modal">
              <button className="lp-btn lp-btn-yellow lp-btn-lg lp-glow-pulse">
                <span>CREATE FREE ACCOUNT</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </SignUpButton>
          </div>
        </div>
      </section>

      {/* ── SECTION 11: FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-container">
          <div className="lp-footer-col-brand">
            <div className="lp-footer-brand">
              <div className="lp-footer-logo-mark">
                <img src="/logo.png" alt="Expezplit Logo" />
              </div>
              <span className="lp-footer-brand-name">EXPEZPLIT</span>
            </div>
            <p className="lp-footer-tagline">
              Precision expense tracking, graph-based debt minimization, and instant QR settlements.
            </p>
            <div className="lp-footer-status">
              <span className="lp-status-dot"></span>
              <span>ALL SYSTEMS OPERATIONAL</span>
            </div>
          </div>

          <div className="lp-footer-links-grid">
            <div className="lp-footer-col">
              <h5>MODULES</h5>
              <a href="#features">Expense Tracker</a>
              <a href="#demo">Recharts Analytics</a>
              <a href="#calculator">Live Split Sandbox</a>
              <a href="#features">QR Payments</a>
            </div>

            <div className="lp-footer-col">
              <h5>RESOURCES</h5>
              <a href="#workflow">Workflow</a>
              <a href="#matrix">System Matrix</a>
              <a href="#testimonials">User Reviews</a>
              <a href="#pricing">Pricing Plans</a>
            </div>

            <div className="lp-footer-col">
              <h5>DEPLOYMENTS</h5>
              <a href="https://expezplit.pages.dev" target="_blank" rel="noreferrer">Cloudflare Pages</a>
              <a href="https://expezplit.netlify.app" target="_blank" rel="noreferrer">Netlify App</a>
              <a href="https://github.com/Patel-Priyank-1602/Expezplit/raw/main/apk_file/Expezplit.apk" target="_blank" rel="noreferrer">Android APK (Download)</a>
              <a href="https://github.com/Patel-Priyank-1602/Expezplit" target="_blank" rel="noreferrer">GitHub Repository</a>
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>&copy; {new Date().getFullYear()} EXPEZPLIT. ALL RIGHTS RESERVED.</span>
          <div className="lp-footer-tech-stack">
            <span>POWERED BY REACT 19 • VITE • SUPABASE • CLERK • RECHARTS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
