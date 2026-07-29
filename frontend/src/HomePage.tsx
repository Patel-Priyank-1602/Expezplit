import { useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/react";

export function HomePage() {
  // State for interactive hero preview tabs
  const [heroTab, setHeroTab] = useState<"analytics" | "split" | "qr">("analytics");

  // State for interactive showcase tabs
  const [demoTab, setDemoTab] = useState<"dashboard" | "splitwise" | "qr" | "currency">("dashboard");

  // State for FAQ accordion
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="lp-root">
      {/* ── HERO SECTION (1ST VIEWPORT WINDOW) ── */}
      <section className="lp-hero-fullscreen">
        <div className="lp-hero-live-badge">
          <span className="lp-badge-dot"></span>
          <span>SMART EXPENSE & BILL SPLITTER</span>
        </div>

        <h1 className="lp-hero-title">
          TRACK WITHOUT LIMITS.
          <br />
          <span className="lp-highlight-yellow">SPLIT-PERFECT.</span>
        </h1>

        <p className="lp-hero-subtitle">
          The all-in-one personal finance platform. Track daily spending with interactive Recharts analytics, 
          split group bills fairly with smart debt minimization, and settle instantly via QR codes.
        </p>

        <div className="lp-hero-actions">
          <SignUpButton mode="modal">
            <button className="lp-btn lp-btn-yellow lp-btn-lg">
              <span>GET STARTED FREE</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </SignUpButton>

          <SignInButton mode="modal">
            <button className="lp-btn lp-btn-outline lp-btn-lg">
              <span>EXPLORE SYSTEM</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
              </svg>
            </button>
          </SignInButton>
        </div>

        {/* Scroll cue link */}
        <a href="#demo" className="lp-hero-scroll-cue">
          <span>EXPLORE LIVE INTERACTIVE DEMO</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </a>
      </section>

      {/* ── HERO MOCKUP INTERACTIVE WINDOW SECTION ── */}
      <section className="lp-mockup-section" id="demo">
        <div className="lp-mockup-frame">
          <div className="lp-mockup-header">
            <div className="lp-window-dots">
              <span className="dot dot-red"></span>
              <span className="dot dot-yellow"></span>
              <span className="dot dot-green"></span>
            </div>
            <div className="lp-mockup-title">expezplit-dashboard.exe</div>
            <div className="lp-mockup-tabs">
              <button 
                className={`lp-mockup-tab ${heroTab === "analytics" ? "active" : ""}`}
                onClick={() => setHeroTab("analytics")}
              >
                <span>📊 Analytics View</span>
              </button>
              <button 
                className={`lp-mockup-tab ${heroTab === "split" ? "active" : ""}`}
                onClick={() => setHeroTab("split")}
              >
                <span>🤝 Group Splitwise</span>
              </button>
              <button 
                className={`lp-mockup-tab ${heroTab === "qr" ? "active" : ""}`}
                onClick={() => setHeroTab("qr")}
              >
                <span>📷 Instant QR Pay</span>
              </button>
            </div>
          </div>

          <div className="lp-mockup-body">
            {heroTab === "analytics" && (
              <div className="lp-preview-content">
                <div className="lp-preview-grid-3">
                  <div className="lp-preview-card">
                    <div className="lp-preview-label">TOTAL SPENT (THIS MONTH)</div>
                    <div className="lp-preview-val">$2,845.50</div>
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
                    <span>SPENDING TREND & CATEGORY INSIGHTS</span>
                    <span className="lp-chart-badge">LIVE RECHARTS ENGINE</span>
                  </div>
                  <div className="lp-simulated-bars">
                    <div className="lp-bar-col"><div className="lp-bar" style={{ height: "45%" }}></div><span>MON</span></div>
                    <div className="lp-bar-col"><div className="lp-bar" style={{ height: "70%" }}></div><span>TUE</span></div>
                    <div className="lp-bar-col"><div className="lp-bar" style={{ height: "30%" }}></div><span>WED</span></div>
                    <div className="lp-bar-col"><div className="lp-bar yellow-accent" style={{ height: "95%" }}></div><span>THU</span></div>
                    <div className="lp-bar-col"><div className="lp-bar" style={{ height: "60%" }}></div><span>FRI</span></div>
                    <div className="lp-bar-col"><div className="lp-bar" style={{ height: "85%" }}></div><span>SAT</span></div>
                    <div className="lp-bar-col"><div className="lp-bar yellow-accent" style={{ height: "50%" }}></div><span>SUN</span></div>
                  </div>
                </div>
              </div>
            )}

            {heroTab === "split" && (
              <div className="lp-preview-content">
                <div className="lp-split-header">
                  <div>
                    <span className="lp-group-name">✈️ Summer EuroTrip 2026</span>
                    <span className="lp-group-meta">4 Members • Currency: USD</span>
                  </div>
                  <span className="lp-chip lp-chip-yellow">DEBT MINIMIZED</span>
                </div>

                <div className="lp-ledger-list">
                  <div className="lp-ledger-item">
                    <div className="lp-user-avatar">AM</div>
                    <div className="lp-ledger-info">
                      <div className="lp-user-name">Alex Miller paid for Airbnb Apartment</div>
                      <div className="lp-ledger-sub">Total $840.00 • Split equally among 4</div>
                    </div>
                    <div className="lp-ledger-balance lp-text-green">+ $630.00</div>
                  </div>

                  <div className="lp-ledger-item">
                    <div className="lp-user-avatar yellow-bg">YOU</div>
                    <div className="lp-ledger-info">
                      <div className="lp-user-name">You paid for Team Dinner & Drinks</div>
                      <div className="lp-ledger-sub">Total $240.00 • Split custom</div>
                    </div>
                    <div className="lp-ledger-balance lp-text-yellow">+ $180.00</div>
                  </div>

                  <div className="lp-settle-box">
                    <div className="lp-settle-title">⚡ MINIMIZED SETTLEMENT SUMMARY</div>
                    <div className="lp-settle-row">
                      <span>Sarah Jenkins owes Alex Miller</span>
                      <strong className="lp-text-yellow">$210.00</strong>
                    </div>
                    <div className="lp-settle-row">
                      <span>Marcus Chen owes You</span>
                      <strong className="lp-text-yellow">$180.00</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {heroTab === "qr" && (
              <div className="lp-preview-content lp-qr-preview">
                <div className="lp-qr-box">
                  <div className="lp-qr-code-dummy">
                    <svg viewBox="0 0 100 100" width="120" height="120">
                      <rect width="100" height="100" fill="#09090B"/>
                      <path d="M10 10h30v30h-30zM60 10h30v30h-30zM10 60h30v30h-30z" fill="#FFE600"/>
                      <path d="M15 15h20v20h-20zM65 15h20v20h-20zM15 65h20v20h-20z" fill="#09090B"/>
                      <path d="M20 20h10v10h-10zM70 20h10v10h-10zM20 70h10v10h-10z" fill="#FFE600"/>
                      <rect x="45" y="10" width="10" height="40" fill="#FFE600"/>
                      <rect x="10" y="45" width="40" height="10" fill="#FFE600"/>
                      <rect x="55" y="55" width="15" height="15" fill="#FFE600"/>
                      <rect x="75" y="75" width="15" height="15" fill="#FFE600"/>
                      <rect x="55" y="75" width="15" height="15" fill="#FFFFFF"/>
                      <rect x="75" y="55" width="15" height="15" fill="#FFE600"/>
                    </svg>
                  </div>
                  <div className="lp-qr-details">
                    <div className="lp-qr-tag">// SCAN TO JOIN OR SETTLE</div>
                    <h3>Group QR Invite Code</h3>
                    <p>Point your camera or use Google Lens to instantly join group <strong>"EuroTrip 2026"</strong> without typing emails.</p>
                    <div className="lp-qr-actions">
                      <button className="lp-btn lp-btn-yellow-sm">DOWNLOAD QR</button>
                      <button className="lp-btn lp-btn-outline-sm">COPY SHARE LINK</button>
                    </div>
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
          <div className="lp-ticker-item"><span>⚡</span> RECHARTS VISUALIZATIONS</div>
          <div className="lp-ticker-item"><span>🔒</span> CLERK SECURE AUTHENTICATION</div>
          <div className="lp-ticker-item"><span>⚡</span> SUPABASE REALTIME DB</div>
          <div className="lp-ticker-item"><span>🌍</span> 200+ CURRENCIES CONVERTER</div>
          <div className="lp-ticker-item"><span>📷</span> IN-APP CAMERA QR SCANNER</div>
          <div className="lp-ticker-item"><span>📧</span> AUTOMATED EMAIL REMINDERS</div>
          <div className="lp-ticker-item"><span>⚡</span> RECHARTS VISUALIZATIONS</div>
          <div className="lp-ticker-item"><span>🔒</span> CLERK SECURE AUTHENTICATION</div>
          <div className="lp-ticker-item"><span>⚡</span> SUPABASE REALTIME DB</div>
        </div>
      </section>

      {/* ── SECTION 1: CORE CAPABILITIES (3-COLUMN CARDS) ── */}
      <section className="lp-section" id="features">
        <div className="lp-section-header">
          <div className="lp-section-tag">// CORE CAPABILITIES</div>
          <h2 className="lp-section-title">EVERYTHING YOU NEED. NOTHING YOU DON'T.</h2>
          <p className="lp-section-desc">Designed with high-density focus for individuals and groups who value absolute precision in their money management.</p>
        </div>

        <div className="lp-cards-grid-3">
          <div className="lp-feature-card lp-card-yellow-border">
            <div className="lp-card-header">
              <span className="lp-card-num">01</span>
              <span className="lp-card-pill pill-yellow">ANALYTICS</span>
            </div>
            <h3>EXPENSE LOGGING & TRENDS</h3>
            <p>
              Log expenses with automatic timestamping, category tags, and real-time area charts. Filter by month, year, or all-time with zero latency.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-yellow">Learn about Analytics →</span>
            </div>
          </div>

          <div className="lp-feature-card lp-card-orange-border">
            <div className="lp-card-header">
              <span className="lp-card-num">02</span>
              <span className="lp-card-pill pill-orange">SPLITWISE</span>
            </div>
            <h3>FAIR BILL SPLITTING</h3>
            <p>
              Create dynamic groups for trips, rent, or dinner. Split costs equally or with custom amounts. Our algorithm automatically minimizes total money transactions.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-orange">Learn about Group Splitting →</span>
            </div>
          </div>

          <div className="lp-feature-card lp-card-cyan-border">
            <div className="lp-card-header">
              <span className="lp-card-num">03</span>
              <span className="lp-card-pill pill-cyan">QR CODES</span>
            </div>
            <h3>INSTANT QR PAYMENTS</h3>
            <p>
              Join groups in 1-second by scanning QR codes. Generate personalized payment QR codes so friends can settle debts without typing bank details.
            </p>
            <div className="lp-card-footer">
              <span className="lp-link-cyan">Learn about QR Integration →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: WORKFLOW (3 STEPS) ── */}
      <section className="lp-section" id="workflow">
        <div className="lp-section-header">
          <div className="lp-section-tag">// THE WORKFLOW</div>
          <h2 className="lp-section-title">THREE STEPS. ZERO EXPENSE DRAMA.</h2>
          <p className="lp-section-desc">From creating a group to final 1-click debt settlement, Expezplit streamlines money tracking in three simple steps.</p>
        </div>

        <div className="lp-steps-grid">
          <div className="lp-step-card">
            <div className="lp-step-huge-num">01</div>
            <h4>CREATE & INVITE</h4>
            <p>
              Set up a group in seconds and share your group code or display the instant QR code for friends to scan and join.
            </p>
          </div>

          <div className="lp-step-card">
            <div className="lp-step-huge-num">02</div>
            <h4>LOG & AUTO-CONVERT</h4>
            <p>
              Record dinner bills, rent, or vacation expenses in any global currency. Expezplit auto-converts exchange rates on the fly.
            </p>
          </div>

          <div className="lp-step-card">
            <div className="lp-step-huge-num">03</div>
            <h4>SETTLE IN 1-CLICK</h4>
            <p>
              View live balance calculations of who owes whom. Send automated email reminders or scan QR codes to mark debts as settled.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: FULL WIDTH SOLID ELECTRIC YELLOW STATS BANNER ── */}
      <section className="lp-stats-banner" id="stats">
        <div className="lp-stats-container">
          <div className="lp-stat-item">
            <div className="lp-stat-val">10K+</div>
            <div className="lp-stat-lbl">ACTIVE USERS</div>
          </div>
          <div className="lp-stat-item">
            <div className="lp-stat-val">99.9%</div>
            <div className="lp-stat-lbl">CALCULATION PRECISION</div>
          </div>
          <div className="lp-stat-item">
            <div className="lp-stat-val">&lt; 1s</div>
            <div className="lp-stat-lbl">INSTANT QR JOIN SPEED</div>
          </div>
          <div className="lp-stat-item">
            <div className="lp-stat-val">200+</div>
            <div className="lp-stat-lbl">CURRENCIES SUPPORTED</div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: TESTIMONIALS ── */}
      <section className="lp-section">
        <div className="lp-section-header">
          <div className="lp-section-tag">// USER REVIEWS</div>
          <h2 className="lp-section-title">REAL USERS. REAL RESULTS.</h2>
          <p className="lp-section-desc">See why thousands of roommates, travelers, and event organizers rely on Expezplit.</p>
        </div>

        <div className="lp-reviews-grid">
          <div className="lp-review-card">
            <div className="lp-review-stars">★★★★★</div>
            <p className="lp-review-quote">
              "Expezplit completely saved our trip to Japan! Splitting restaurant tabs in Yen and having it auto-convert to USD live was absolute magic."
            </p>
            <div className="lp-review-author">
              <div className="lp-author-avatar">AM</div>
              <div>
                <div className="lp-author-name">Alex Miller</div>
                <div className="lp-author-title">Senior Software Engineer</div>
              </div>
              <span className="lp-verified-tag">[ VERIFIED ]</span>
            </div>
          </div>

          <div className="lp-review-card">
            <div className="lp-review-stars">★★★★★</div>
            <p className="lp-review-quote">
              "The QR code scan-to-join feature is genius. When we order group food, everyone just scans my phone screen and they are in the group."
            </p>
            <div className="lp-review-author">
              <div className="lp-author-avatar yellow-bg">PK</div>
              <div>
                <div className="lp-author-name">Priya Kapoor</div>
                <div className="lp-author-title">Product Designer</div>
              </div>
              <span className="lp-verified-tag">[ VERIFIED ]</span>
            </div>
          </div>

          <div className="lp-review-card">
            <div className="lp-review-stars">★★★★★</div>
            <p className="lp-review-quote">
              "The Recharts dashboard gave me crystal-clear insights into my monthly subscriptions. I eliminated $140/mo in unused services!"
            </p>
            <div className="lp-review-author">
              <div className="lp-author-avatar">DL</div>
              <div>
                <div className="lp-author-name">David Lee</div>
                <div className="lp-author-title">Founder @ TechStart</div>
              </div>
              <span className="lp-verified-tag">[ VERIFIED ]</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: BENTO BOX SYSTEM MATRIX ── */}
      <section className="lp-section" id="matrix">
        <div className="lp-section-header">
          <div className="lp-section-tag">// SYSTEM MATRIX</div>
          <h2 className="lp-section-title">BUILT FOR MAXIMUM CONTROL</h2>
          <p className="lp-section-desc">A complete suite of financial tools engineered for speed, privacy, and seamless operation.</p>
        </div>

        <div className="lp-bento-grid">
          <div className="lp-bento-card bento-yellow">
            <div className="lp-bento-tag">// FEATURED MODULE</div>
            <h3>SMART EXPENSE COMPANION</h3>
            <p>
              Granular expense logging with instant categorization, custom tags, date filtering, and live Recharts charts.
            </p>
            <div className="lp-bento-badge">SYSTEM CORE</div>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// ALGORITHM</div>
            <h3>DEBT MINIMIZER</h3>
            <p>Calculates the absolute minimum number of payments required between group members.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// ENGINE</div>
            <h3>MULTI-CURRENCY</h3>
            <p>Auto-fetches real-time exchange rates across 200+ fiat currencies globally.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// NOTIFICATIONS</div>
            <h3>EMAIL REMINDERS</h3>
            <p>Automated Node.js & Nodemailer alerts sent directly to members with due balances.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// HARDWARE</div>
            <h3>IN-APP CAMERA QR</h3>
            <p>Scan friend payment QR codes directly inside the browser without external apps.</p>
          </div>

          <div className="lp-bento-card">
            <div className="lp-bento-tag">// EXPORT</div>
            <h3>1-CLICK CSV EXPORT</h3>
            <p>Download full expense histories and group audit logs for offline Excel reporting.</p>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: COMPARISON MATRIX TABLE ── */}
      <section className="lp-section">
        <div className="lp-section-header">
          <div className="lp-section-tag">// FEATURE COMPARISON</div>
          <h2 className="lp-section-title">WHY CHOOSE EXPEZPLIT</h2>
          <p className="lp-section-desc">Compare Expezplit against manual spreadsheets and standard expense splitting apps.</p>
        </div>

        <div className="lp-table-wrapper">
          <table className="lp-matrix-table">
            <thead>
              <tr>
                <th>FEATURE</th>
                <th className="lp-th-highlight">EXPEZPLIT</th>
                <th>EXCEL / SPREADSHEETS</th>
                <th>BASIC SPLIT APPS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Instant QR Code Group Join</td>
                <td className="lp-td-highlight">✓ YES (Instant)</td>
                <td>✗ NO</td>
                <td>✗ NO</td>
              </tr>
              <tr>
                <td>Multi-Currency Auto Conversion</td>
                <td className="lp-td-highlight">✓ YES (200+ Currencies)</td>
                <td>✗ Manual Formulas</td>
                <td>⚠️ Limited / Paid</td>
              </tr>
              <tr>
                <td>Smart Debt Minimization</td>
                <td className="lp-td-highlight">✓ YES (Optimal)</td>
                <td>✗ NO</td>
                <td>✓ Partial</td>
              </tr>
              <tr>
                <td>Automated Email Debt Alerts</td>
                <td className="lp-td-highlight">✓ YES (Automated)</td>
                <td>✗ NO</td>
                <td>⚠️ Manual Ping</td>
              </tr>
              <tr>
                <td>Interactive Recharts Dashboard</td>
                <td className="lp-td-highlight">✓ YES (Real-time)</td>
                <td>⚠️ Basic Charts</td>
                <td>✗ NO</td>
              </tr>
              <tr>
                <td>1-Click CSV / Audit Export</td>
                <td className="lp-td-highlight">✓ YES (1-Click)</td>
                <td>✓ Native</td>
                <td>⚠️ Paid Tier</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── SECTION 7: INTERACTIVE DEMO SHOWCASE TABS ── */}
      <section className="lp-section">
        <div className="lp-section-header">
          <div className="lp-section-tag">// LIVE MODULE SHOWCASE</div>
          <h2 className="lp-section-title">EXPLORE THE EXPEZPLIT MODULES</h2>
          <p className="lp-section-desc">Click through the tabs below to preview each powerful core module.</p>
        </div>

        <div className="lp-demo-tabs-nav">
          <button 
            className={`lp-demo-tab-btn ${demoTab === "dashboard" ? "active" : ""}`}
            onClick={() => setDemoTab("dashboard")}
          >
            📊 EXPENSE TRACKER & CHARTS
          </button>
          <button 
            className={`lp-demo-tab-btn ${demoTab === "splitwise" ? "active" : ""}`}
            onClick={() => setDemoTab("splitwise")}
          >
            🤝 GROUP BILL SPLITTER
          </button>
          <button 
            className={`lp-demo-tab-btn ${demoTab === "qr" ? "active" : ""}`}
            onClick={() => setDemoTab("qr")}
          >
            📷 QR CODE GENERATOR & SCANNER
          </button>
          <button 
            className={`lp-demo-tab-btn ${demoTab === "currency" ? "active" : ""}`}
            onClick={() => setDemoTab("currency")}
          >
            🌍 MULTI-CURRENCY CONVERTER
          </button>
        </div>

        <div className="lp-demo-display-card">
          {demoTab === "dashboard" && (
            <div className="lp-demo-content-box">
              <div className="lp-demo-info">
                <h3>Visual Analytics & Spending Category Breakdown</h3>
                <p>
                  Understand exactly where every penny goes with Recharts pie and area graphs. 
                  Filter by current month, year, or custom date ranges with real-time budget calculations.
                </p>
                <div className="lp-demo-list">
                  <div className="lp-demo-item">✓ Automatic Date & Timestamping</div>
                  <div className="lp-demo-item">✓ Interactive Hover Tooltips</div>
                  <div className="lp-demo-item">✓ Category Breakdown Percentages</div>
                </div>
              </div>
              <div className="lp-demo-graphic graphic-charts">
                <div className="lp-graphic-pie">
                  <div className="lp-pie-slice s1"></div>
                  <div className="lp-pie-slice s2"></div>
                  <div className="lp-pie-slice s3"></div>
                  <div className="lp-pie-center"><span>34% Food</span></div>
                </div>
              </div>
            </div>
          )}

          {demoTab === "splitwise" && (
            <div className="lp-demo-content-box">
              <div className="lp-demo-info">
                <h3>Dynamic Group Bill Splitting</h3>
                <p>
                  Input collective bills for trips, dining out, or rent. Expezplit calculates custom or equal shares 
                  and reduces 10 complex transactions down to the fewest direct payments.
                </p>
                <div className="lp-demo-list">
                  <div className="lp-demo-item">✓ Equal & Custom Percentage Split</div>
                  <div className="lp-demo-item">✓ Live Balance Summaries</div>
                  <div className="lp-demo-item">✓ Instant 1-Click Settlement Logging</div>
                </div>
              </div>
              <div className="lp-demo-graphic graphic-ledger">
                <div className="lp-mock-ledger-card">
                  <div className="lp-mock-row"><span>Alex ➔ You</span><strong className="lp-text-yellow">$45.00</strong></div>
                  <div className="lp-mock-row"><span>Sarah ➔ You</span><strong className="lp-text-yellow">$110.00</strong></div>
                  <div className="lp-mock-row"><span>Total Owed to You</span><strong className="lp-text-green">$155.00</strong></div>
                </div>
              </div>
            </div>
          )}

          {demoTab === "qr" && (
            <div className="lp-demo-content-box">
              <div className="lp-demo-info">
                <h3>QR Code Scan-to-Join & Payment Links</h3>
                <p>
                  No more manually typing email invitations or bank account numbers. 
                  Generate unique group QR codes and scan friends' payment QR codes directly via web camera.
                </p>
                <div className="lp-demo-list">
                  <div className="lp-demo-item">✓ In-App Camera QR Reader (html5-qrcode)</div>
                  <div className="lp-demo-item">✓ Instant Group Room Auto-Join</div>
                  <div className="lp-demo-item">✓ Personalized Payment QR Cards</div>
                </div>
              </div>
              <div className="lp-demo-graphic graphic-qr">
                <div className="lp-qr-badge">QR CODE LIVE SIMULATOR</div>
              </div>
            </div>
          )}

          {demoTab === "currency" && (
            <div className="lp-demo-content-box">
              <div className="lp-demo-info">
                <h3>Real-Time Global Currency Support</h3>
                <p>
                  Traversing international borders? Expezplit automatically handles conversion rates across 
                  200+ currencies so everyone pays in their preferred currency without math headaches.
                </p>
                <div className="lp-demo-list">
                  <div className="lp-demo-item">✓ Live Fiat Exchange Rates</div>
                  <div className="lp-demo-item">✓ Support for USD, EUR, GBP, INR, JPY & 200+</div>
                  <div className="lp-demo-item">✓ Multi-Currency Group Expense Logging</div>
                </div>
              </div>
              <div className="lp-demo-graphic graphic-currency">
                <div className="lp-curr-row"><span>1 USD = 0.92 EUR</span></div>
                <div className="lp-curr-row"><span>1 USD = 83.50 INR</span></div>
                <div className="lp-curr-row"><span>1 USD = 155.20 JPY</span></div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 8: FAQ ACCORDION ── */}
      <section className="lp-section" id="faq">
        <div className="lp-section-header">
          <div className="lp-section-tag">// FREQUENTLY ASKED QUESTIONS</div>
          <h2 className="lp-section-title">EVERYTHING YOU NEED TO KNOW</h2>
          <p className="lp-section-desc">Got questions about Expezplit? We've got answers.</p>
        </div>

        <div className="lp-faq-container">
          {[
            {
              q: "Is Expezplit completely free to use?",
              a: "Yes! Expezplit is 100% free with no hidden charges, no credit card required, and unlimited personal expense tracking and group bill splitting."
            },
            {
              q: "How does the QR code group join work?",
              a: "When you create a group in Expezplit, a unique QR code is automatically generated. Friends can simply scan the QR code using their camera or Google Lens to instantly join the group room."
            },
            {
              q: "Can we split expenses in different currencies during international trips?",
              a: "Absolutely! You can select any of the 200+ supported global currencies when logging an expense. Expezplit automatically handles multi-currency conversions and displays normalized balances."
            },
            {
              q: "How do automated email payment reminders work?",
              a: "If a group member has a pending debt, you can send automated email notifications with 1-click. Our Node.js microservice sends a detailed balance summary straight to their email inbox."
            },
            {
              q: "Is my personal financial data secure?",
              a: "Yes. Authentication is managed securely by Clerk, and all data is encrypted in transit and at rest using Supabase (PostgreSQL)."
            }
          ].map((item, idx) => (
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
          <p className="lp-section-desc">Pick the plan that fits your personal and group budgeting needs.</p>
        </div>

        <div className="lp-pricing-grid">
          {/* Plan 1 */}
          <div className="lp-pricing-card">
            <div className="lp-pricing-plan-name">STARTER</div>
            <div className="lp-pricing-price">$0 <span>/ mo</span></div>
            <p className="lp-pricing-desc">Perfect for individual expense tracking and basic budgeting.</p>
            <div className="lp-pricing-features">
              <div className="lp-pricing-item">✓ Personal Expense Tracker</div>
              <div className="lp-pricing-item">✓ Category Pie Charts</div>
              <div className="lp-pricing-item">✓ Up to 3 Active Groups</div>
              <div className="lp-pricing-item">✓ Manual CSV Export</div>
            </div>
            <SignUpButton mode="modal">
              <button className="lp-btn lp-btn-outline-sm w-full">GET STARTER</button>
            </SignUpButton>
          </div>

          {/* Plan 2: FEATURED PRO PLAN IN YELLOW */}
          <div className="lp-pricing-card lp-pricing-featured">
            <div className="lp-pricing-featured-badge">[ MOST POPULAR ]</div>
            <div className="lp-pricing-plan-name lp-text-yellow">PRO UNLIMITED</div>
            <div className="lp-pricing-price">$0 <span>/ FOREVER</span></div>
            <p className="lp-pricing-desc">Everything you need for unlimited personal and group financial clarity.</p>
            <div className="lp-pricing-features">
              <div className="lp-pricing-item">✓ Unlimited Personal Expenses</div>
              <div className="lp-pricing-item">✓ Unlimited Groups & Roommates</div>
              <div className="lp-pricing-item">✓ Recharts Area & Pie Graphs</div>
              <div className="lp-pricing-item">✓ Multi-Currency Auto Conversion</div>
              <div className="lp-pricing-item">✓ Instant QR Scan-To-Join</div>
              <div className="lp-pricing-item">✓ In-App Payment QR Generator</div>
              <div className="lp-pricing-item">✓ Automated Email Debt Alerts</div>
              <div className="lp-pricing-item">✓ 1-Click CSV Data Export</div>
            </div>
            <SignUpButton mode="modal">
              <button className="lp-btn lp-btn-yellow w-full">START FREE NOW →</button>
            </SignUpButton>
          </div>

          {/* Plan 3 */}
          <div className="lp-pricing-card">
            <div className="lp-pricing-plan-name">ENTERPRISE</div>
            <div className="lp-pricing-price">CUSTOM</div>
            <p className="lp-pricing-desc">For large teams, events, and custom backend API microservices.</p>
            <div className="lp-pricing-features">
              <div className="lp-pricing-item">✓ Everything in Pro Unlimited</div>
              <div className="lp-pricing-item">✓ Custom Microservice Integration</div>
              <div className="lp-pricing-item">✓ Dedicated Nodemailer SMTP Server</div>
              <div className="lp-pricing-item">✓ Priority 24/7 Developer Support</div>
            </div>
            <SignUpButton mode="modal">
              <button className="lp-btn lp-btn-outline-sm w-full">CONTACT SALES</button>
            </SignUpButton>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: CTA BANNER ── */}
      <section className="lp-cta-section">
        <div className="lp-cta-box">
          <div className="lp-cta-tag">// GET STARTED TODAY</div>
          <h2>READY TO ELIMINATE EXPENSE DRAMA?</h2>
          <p>Join thousands of users who track daily spending and split group bills effortlessly.</p>
          <div className="lp-cta-buttons">
            <SignUpButton mode="modal">
              <button className="lp-btn lp-btn-yellow lp-btn-lg">
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
              Precision expense tracking, intelligent bill splitting, and instant QR payments.
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
              <a href="#features">Analytics</a>
              <a href="#features">Group Splitwise</a>
              <a href="#features">QR Payments</a>
            </div>

            <div className="lp-footer-col">
              <h5>RESOURCES</h5>
              <a href="#workflow">Workflow</a>
              <a href="#matrix">System Matrix</a>
              <a href="#faq">FAQ</a>
              <a href="#pricing">Pricing</a>
            </div>

            <div className="lp-footer-col">
              <h5>DEPLOYMENTS</h5>
              <a href="https://expezplit.pages.dev" target="_blank" rel="noreferrer">Cloudflare Pages</a>
              <a href="https://expezplit.netlify.app" target="_blank" rel="noreferrer">Netlify App</a>
              <a href="https://github.com/Patel-Priyank-1602/Expezplit/raw/main/apk_file/Expezplit.apk" target="_blank" rel="noreferrer">Android APK</a>
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>&copy; {new Date().getFullYear()} EXPEZPLIT. ALL RIGHTS RESERVED.</span>
          <div className="lp-footer-tech-stack">
            <span>BUILT WITH REACT 19 • VITE • SUPABASE • CLERK • RECHARTS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
