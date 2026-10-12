
import { useEffect, useState } from "react";
import "./index.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001";
  
async function apiRequest(path, options = {}, token = "") {
  const { body, ...fetchOptions } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || data?.message || "Something went wrong."
    );
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }

  return data;
}

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("fitqueue_user") || "null");
  } catch {
    return null;
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("fitqueue_token") || ""
  );
  const [user, setUser] = useState(getSavedUser);

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [waitlisted, setWaitlisted] = useState([]);

  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshDashboard() {
  const [sessionData, bookingData, waitlistData] = await Promise.all([
    apiRequest("/api/sessions", {}, token),
    apiRequest("/api/bookings", {}, token),
    apiRequest("/api/waitlist", {}, token),
  ]);

  setSessions(sessionData.sessions || []);
  setBookings(bookingData.bookings || []);

  setWaitlisted(
    (waitlistData.waitlist || []).map((entry) => String(entry.session_id))
  );
}
  useEffect(() => {
    let active = true;

    if (!token) {
      setSessions([]);
      setBookings([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    async function loadDashboard() {
      setLoading(true);

      try {
        const [sessionData, bookingData, waitlistData] = await Promise.all([
  apiRequest("/api/sessions", {}, token),
  apiRequest("/api/bookings", {}, token),
  apiRequest("/api/waitlist", {}, token),
]);

if (active) {
  setSessions(sessionData.sessions || []);
  setBookings(bookingData.bookings || []);

  setWaitlisted(
    (waitlistData.waitlist || []).map((entry) =>
      String(entry.session_id)
    )
  );

  setError("");
}
      } catch (err) {
        if (active) {
          setError(err.message);

          if (err.status === 401) {
            localStorage.removeItem("fitqueue_token");
            localStorage.removeItem("fitqueue_user");
            setToken("");
            setUser(null);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleAuth(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setAuthBusy(true);

    try {
      const credentials = { email: email.trim(), password };

      if (mode === "register") {
        await apiRequest("/api/auth/register", {
          method: "POST",
          body: { ...credentials, name: name.trim() },
        });
      }

      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: credentials,
      });

      localStorage.setItem("fitqueue_token", result.token);
      localStorage.setItem("fitqueue_user", JSON.stringify(result.user));

      setUser(result.user);
      setToken(result.token);
      setPassword("");
      setNotice(
        mode === "register"
          ? "Your account has been created successfully."
          : "Welcome back!"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("fitqueue_token");
    localStorage.removeItem("fitqueue_user");

    setToken("");
    setUser(null);
    setSessions([]);
    setBookings([]);
    setWaitlisted([]);
    setError("");
    setNotice("");
    setEmail("");
    setPassword("");
  }

  async function handleBook(session) {
    setBusyAction(`session-${session.id}`);
    setError("");
    setNotice("");

    try {
      await apiRequest(
        `/api/sessions/${session.id}/book`,
        { method: "POST" },
        token
      );

      setNotice("Session booked successfully. Your booking is ready.");
      await refreshDashboard();
    } catch (err) {
      setError(err.message);

      if (err.code === "ALREADY_BOOKED") {
        await refreshDashboard().catch(() => {});
      }
    } finally {
      setBusyAction("");
    }
  }

  async function handleWaitlist(session) {
    setBusyAction(`session-${session.id}`);
    setError("");
    setNotice("");

    try {
      await apiRequest(
        `/api/sessions/${session.id}/waitlist`,
        { method: "POST" },
        token
      );

      setWaitlisted((previous) => [...new Set([...previous, String(session.id)])]);
      setNotice("You've joined the waitlist for this session.");
    } catch (err) {
      if (err.code === "ALREADY_WAITLISTED") {
        setWaitlisted((previous) => [
          ...new Set([...previous, String(session.id)]),
        ]);
        setNotice("You're already on this session's waitlist.");
      } else {
        setError(err.message);
      }
    } finally {
      setBusyAction("");
    }
  }

  async function handleCancel(booking) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this booking?"
    );

    if (!confirmed) return;

    setBusyAction(`booking-${booking.id}`);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        `/api/bookings/${booking.id}`,
        { method: "DELETE" },
        token
      );

      setNotice(
        result.promoted
          ? "Booking cancelled. The next member on the waitlist was promoted."
          : "Your booking has been cancelled."
      );

      await refreshDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction("");
    }
  }

  const upcomingSessions = sessions.filter(
    (session) => new Date(session.starts_at) > new Date()
  );

  const upcomingBookings = bookings.filter(
    (booking) => new Date(booking.starts_at) > new Date()
  );

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-visual">
          <div className="brand brand-light">
            <span className="brand-mark">F</span>
            <span>FitQueue</span>
          </div>

          <div className="auth-hero">
            <span className="eyebrow">YOUR TIME. YOUR TRAINING.</span>
            <h1>Make every session count.</h1>
            <p>
              Find your next workout, reserve your spot, and let FitQueue
              handle the queue.
            </p>

            <div className="visual-stat">
              <span className="stat-icon">✓</span>
              <div>
                <strong>Simple session booking</strong>
                <span>Reserve your place in a few clicks</span>
              </div>
            </div>

            <div className="visual-stat">
              <span className="stat-icon">↗</span>
              <div>
                <strong>Smart waitlists</strong>
                <span>Get promoted when a spot opens up</span>
              </div>
            </div>
          </div>

          <p className="visual-footer">A simpler way to stay consistent.</p>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="mobile-brand brand">
              <span className="brand-mark">F</span>
              <span>FitQueue</span>
            </div>

            <span className="eyebrow">WELCOME TO FITQUEUE</span>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="muted">
              {mode === "login"
                ? "Sign in to manage your training sessions."
                : "Join FitQueue to start booking sessions."}
            </p>

            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "tab active" : "tab"}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={mode === "register" ? "tab active" : "tab"}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              {mode === "register" && (
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your name"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  minLength={mode === "register" ? 6 : 1}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
              </label>

              {error && <div className="feedback error">{error}</div>}
              {notice && <div className="feedback success">{notice}</div>}

              <button
                className="button button-primary button-full"
                type="submit"
                disabled={authBusy}
              >
                {authBusy
                  ? "Please wait..."
                  : mode === "login"
                    ? "Sign in →"
                    : "Create account →"}
              </button>
            </form>

            <p className="form-footnote">
              By continuing, you agree to use FitQueue responsibly and keep
              your account details secure.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#dashboard" aria-label="FitQueue home">
          <span className="brand-mark">F</span>
          <span>FitQueue</span>
        </a>

        <div className="topbar-right">
          <div className="user-chip">
            <span className="avatar">
              {(user?.name || user?.email || "M").charAt(0).toUpperCase()}
            </span>
            <div className="user-details">
              <strong>{user?.name || "Member"}</strong>
              <span>{user?.role || "MEMBER"}</span>
            </div>
          </div>
          <button className="button button-outline button-small" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="dashboard" id="dashboard">
        <section className="welcome-row">
          <div>
            <span className="eyebrow">MEMBER DASHBOARD</span>
            <h1>Good to see you, {user?.name?.split(" ")[0] || "there"}.</h1>
            <p className="muted">
              Find a session, reserve your place, and keep your routine moving.
            </p>
          </div>
          <div className="today-chip">
            <span className="today-dot" />
            Session booking
          </div>
        </section>

        {(error || notice) && (
          <div className={`feedback page-feedback ${error ? "error" : "success"}`}>
            <span>{error ? "!" : "✓"}</span>
            <p>{error || notice}</p>
            <button
              className="feedback-close"
              onClick={() => {
                setError("");
                setNotice("");
              }}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">Upcoming sessions</span>
              <span className="stat-card-icon">▦</span>
            </div>
            <strong className="stat-number">{upcomingSessions.length}</strong>
            <span className="stat-note">Available to explore</span>
          </article>

          <article className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">My bookings</span>
              <span className="stat-card-icon">✓</span>
            </div>
            <strong className="stat-number">{upcomingBookings.length}</strong>
            <span className="stat-note">Upcoming reservations</span>
          </article>

          <article className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">Waitlist</span>
              <span className="stat-card-icon">↗</span>
            </div>
            <strong className="stat-number">{waitlisted.length}</strong>
            <span className="stat-note">Sessions you're waiting for</span>
          </article>
        </section>

        <div className="content-grid">
          <section className="main-column">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PLAN AHEAD</span>
                <h2>Upcoming sessions</h2>
              </div>
              <span className="count-pill">{upcomingSessions.length} sessions</span>
            </div>

            {loading ? (
              <div className="empty-card">Loading your sessions...</div>
            ) : upcomingSessions.length === 0 ? (
              <div className="empty-card">
                <span className="empty-icon">▦</span>
                <h3>No upcoming sessions</h3>
                <p>Check back later for new sessions to book.</p>
              </div>
            ) : (
              <div className="session-list">
                {upcomingSessions.map((session) => {
                  const seats = Number(session.seats_remaining);
                  const hasBooking = bookings.some(
                    (booking) =>
                      String(booking.session_id) === String(session.id)
                  );
                  const isWaitlisted = waitlisted.includes(String(session.id));
                  const isBusy = busyAction === `session-${session.id}`;

                  return (
                    <article className="session-card" key={session.id}>
                      <div className="session-date">
                        <span>{new Date(session.starts_at).toLocaleDateString(
                          "en-IN",
                          { month: "short" }
                        ).toUpperCase()}</span>
                        <strong>{new Date(session.starts_at).getDate()}</strong>
                        <span>{formatTime(session.starts_at)}</span>
                      </div>

                      <div className="session-info">
                        <div className="session-title-row">
                          <h3>Training session</h3>
                          <span
                            className={`status-pill ${
                              seats > 0 ? "status-available" : "status-full"
                            }`}
                          >
                            {seats > 0 ? "Available" : "Full"}
                          </span>
                        </div>
                        <p className="session-subtitle">
                          {formatDate(session.starts_at)}
                        </p>
                        <div className="seat-row">
                          <div className="seat-track">
                            <span
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    ((Number(session.capacity) - seats) /
                                      Number(session.capacity)) *
                                      100
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                          <span>
                            {seats} of {session.capacity} seats left
                          </span>
                        </div>

                        <div className="session-actions">
                          {hasBooking ? (
                            <span className="booked-label">✓ You're booked</span>
                          ) : isWaitlisted ? (
                            <span className="waiting-label">On the waitlist</span>
                          ) : seats > 0 ? (
                            <button
                              className="button button-primary"
                              onClick={() => handleBook(session)}
                              disabled={Boolean(busyAction)}
                            >
                              {isBusy ? "Booking..." : "Book session"}
                            </button>
                          ) : (
                            <button
                              className="button button-outline"
                              onClick={() => handleWaitlist(session)}
                              disabled={Boolean(busyAction)}
                            >
                              {isBusy ? "Joining..." : "Join waitlist"}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="side-column">
            <section className="side-card">
              <div className="section-heading compact-heading">
                <div>
                  <span className="eyebrow">YOUR SCHEDULE</span>
                  <h2>My bookings</h2>
                </div>
                <span className="booking-count">{bookings.length}</span>
              </div>

              {loading ? (
                <p className="muted">Loading bookings...</p>
              ) : bookings.length === 0 ? (
                <div className="side-empty">
                  <span>▤</span>
                  <p>You haven't booked a session yet.</p>
                </div>
              ) : (
                <div className="booking-list">
                  {bookings.map((booking) => (
                    <article className="booking-item" key={booking.id}>
                      <div className="booking-item-head">
                        <span className="booking-ticket">BOOKING</span>
                        <span className="booking-id">#{booking.id}</span>
                      </div>
                      <h3>Training session</h3>
                      <p>{formatDate(booking.starts_at)}</p>
                      <p>{formatTime(booking.starts_at)}</p>
                      <div className="booking-code">
                        <span>Booking code</span>
                        <strong>{booking.code}</strong>
                      </div>
                      {new Date(booking.starts_at) > new Date() &&
                        !booking.checked_in && (
                          <button
                            className="button button-danger button-full"
                            onClick={() => handleCancel(booking)}
                            disabled={Boolean(busyAction)}
                          >
                            {busyAction === `booking-${booking.id}`
                              ? "Cancelling..."
                              : "Cancel booking"}
                          </button>
                        )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="help-card">
              <div className="help-icon">i</div>
              <div>
                <h3>How FitQueue works</h3>
                <p>
                  Book an open seat. If a session is full, join the waitlist.
                  When someone cancels, the next member is promoted
                  automatically.
                </p>
              </div>
            </section>
          </aside>
        </div>

        <footer className="app-footer">
          <span>FitQueue</span>
          <span>Simple bookings. Smarter queues.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
