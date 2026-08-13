import React from "react";

/**
 * Catches any rendering error anywhere below it and shows it plainly
 * instead of leaving the page blank/frozen with no visible explanation.
 */
export default class DcsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { caught_error: null };
  }

  static getDerivedStateFromError(caught_error) {
    return { caught_error };
  }

  render() {
    if (this.state.caught_error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#F7F9FB" }}>
          <div className="w-full border-2 bg-white p-6" style={{ maxWidth: 500, borderColor: "#E74C3C" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "#E74C3C", fontFamily: "'Montserrat', sans-serif" }}>
              Something went wrong while showing this page
            </p>
            <p className="text-xs" style={{ color: "#333333", whiteSpace: "pre-wrap" }}>
              {this.state.caught_error.message || String(this.state.caught_error)}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
