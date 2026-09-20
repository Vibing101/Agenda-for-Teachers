import ReactDOM from "react-dom/client";

const root = ReactDOM.createRoot(document.getElementById("root")!);

/**
 * The same page serves two purposes.
 *
 * Normally it is the app. Opened with `?print=1` — which only the Rust side
 * ever does, in a hidden window — it is the surface a PDF is rendered from,
 * and it deliberately loads neither the app's stylesheet (which follows the
 * OS's dark mode, and a printed page must not) nor StrictMode's double render
 * (a print is a one-shot side effect).
 */
if (new URLSearchParams(window.location.search).has("print")) {
  const { default: PrintHost } = await import("./print/PrintHost");
  root.render(<PrintHost />);
} else {
  await import("./styles.css");
  const [{ default: App }, { StrictMode }] = await Promise.all([
    import("./App"),
    import("react"),
  ]);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
