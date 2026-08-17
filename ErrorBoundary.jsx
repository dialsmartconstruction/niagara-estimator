import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error && error.message ? error.message : String(error) };
  }

  componentDidCatch(error, info) {
    // Log to the browser console so it's easy to find during testing.
    console.error("App crashed:", error, info);
  }

  handleReset = () => {
    // Clear the crash state and reload from scratch — safest recovery
    // since we don't know which piece of state caused the crash.
    this.setState({ hasError: false, message: "" });
    window.location.href = window.location.origin + window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            background: "#F8FBFF",
          }}
        >
          <p style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "#0F172A" }}>
            Something went wrong on this screen
          </p>
          <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "20px", maxWidth: "360px" }}>
            No data was lost — this just stopped one screen from loading correctly.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              backgroundColor: "#7C2D12",
              color: "white",
              padding: "10px 24px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Go back home
          </button>
          {this.state.message && (
            <p style={{ fontSize: "11px", color: "#CBD5E1", marginTop: "16px", maxWidth: "360px" }}>
              {this.state.message}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
