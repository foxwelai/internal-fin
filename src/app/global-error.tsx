"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body
        style={{
          background: "#0a0b0d",
          color: "#e9ebef",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Foxwel Finance could not start</h1>
          <p style={{ marginTop: "0.5rem", color: "#8b929e", fontSize: "0.875rem", maxWidth: "28rem" }}>
            The application failed before it could render. Check the server logs and the database
            connection.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              background: "#f4551d",
              color: "white",
              border: 0,
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
