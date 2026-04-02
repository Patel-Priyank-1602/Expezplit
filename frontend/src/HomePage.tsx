import { SignInButton, SignUpButton } from "@clerk/react";

export function HomePage() {
  return (
    <div className="home-landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-tag">Free to use — no credit card required</div>

        <h1>
          Track expenses.
          <br />
          <span>Split bills fairly.</span>
        </h1>

        <p className="hero-desc">
          Your personal finance companion. Log daily expenses with real-time
          charts, and split group bills with friends — all in one place.
        </p>

        <div className="hero-buttons">
          <SignUpButton mode="modal">
            <button className="btn btn-primary btn-lg">Get started free</button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="btn btn-secondary btn-lg">Sign in</button>
          </SignInButton>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="features-label">Features</div>
        <h2>Everything you need to manage money</h2>

        <div className="features-grid">
          <div className="feat-card">
            <div className="feat-icon purple">$</div>
            <h3>Expense Tracker</h3>
            <p>
              Add expenses with name, category, and amount. Date and time are
              saved automatically.
            </p>
          </div>

          <div className="feat-card">
            <div className="feat-icon red">%</div>
            <h3>Category Breakdown</h3>
            <p>
              See what percentage of your spending goes to each category with an
              interactive pie chart.
            </p>
          </div>

          <div className="feat-card">
            <div className="feat-icon green">~</div>
            <h3>Spending Trends</h3>
            <p>
              Track how your spending changes over time with a date-wise area
              chart that updates instantly.
            </p>
          </div>

          <div className="feat-card">
            <div className="feat-icon amber">T</div>
            <h3>Time Filters</h3>
            <p>
              View your data for this month, this year, or all time. Both
              charts update based on your selection.
            </p>
          </div>

          <div className="feat-card">
            <div className="feat-icon blue">G</div>
            <h3>Group Bill Splitting</h3>
            <p>
              Create groups, share invite codes, and split expenses equally or
              with custom amounts per person.
            </p>
          </div>

          <div className="feat-card">
            <div className="feat-icon purple">S</div>
            <h3>Secure Sign-in</h3>
            <p>
              Sign up with email, phone, or social accounts. Your data is
              private and tied to your account.
            </p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="steps-section">
        <h2>Get started in 4 steps</h2>

        <ol className="step-list">
          <li className="step">
            <div className="step-num">1</div>
            <div>
              <h4>Create an account</h4>
              <p>Click "Get started free" and sign up in seconds.</p>
            </div>
          </li>
          <li className="step">
            <div className="step-num">2</div>
            <div>
              <h4>Choose your tool</h4>
              <p>
                Switch between Expense Tracker for personal spending or
                Splitwise for group bills.
              </p>
            </div>
          </li>
          <li className="step">
            <div className="step-num">3</div>
            <div>
              <h4>Add expenses</h4>
              <p>
                Enter name, category, and amount. Date and time are recorded for
                you.
              </p>
            </div>
          </li>
          <li className="step">
            <div className="step-num">4</div>
            <div>
              <h4>See your insights</h4>
              <p>
                Charts update instantly. In Splitwise, see who owes who at a
                glance.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* CTA */}
      <section className="cta-banner">
        <div className="cta-box">
          <h2>Ready to take control?</h2>
          <p>
            Start tracking expenses and splitting bills today.
          </p>
          <SignUpButton mode="modal">
            <button className="btn btn-primary btn-lg">Create free account</button>
          </SignUpButton>
        </div>
      </section>
    </div>
  );
}
