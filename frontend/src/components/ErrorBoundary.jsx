import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[APP RUNTIME RECOVERY]", error, errorInfo);

    // If chunk loading or dynamic module import failed due to a new deployment, auto-reload once
    const msg = String(error?.message || "");
    const isChunkFailure = /dynamically imported module|Loading chunk|Failed to fetch dynamically/i.test(msg);
    if (isChunkFailure) {
      const lastReload = parseInt(sessionStorage.getItem("last_chunk_reload") || "0", 10);
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem("last_chunk_reload", Date.now().toString());
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem("last_chunk_reload");
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "#09090b",
            color: "#f4f4f5",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            zIndex: 9999999
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              backgroundColor: "rgba(225, 29, 72, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "18px",
              border: "1px solid rgba(225, 29, 72, 0.25)"
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "8px", color: "#f4f4f5" }}>
            Session Suspended
          </h2>
          <p style={{ fontSize: "14px", color: "#a1a1aa", maxWidth: "340px", lineHeight: "1.5", marginBottom: "24px" }}>
            The app was paused while inactive. Tap below to reload your feed.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              backgroundColor: "#e11d48",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "12px 28px",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(225, 29, 72, 0.35)",
              transition: "transform 0.15s ease"
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
