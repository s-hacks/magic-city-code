// App entry: global styles (index.css = the UI prototype look, styles.css = app extras),
// the router, and the shared app state.
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AppProvider } from "./mission/AppContext";
import "./index.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AppProvider>
      <App />
    </AppProvider>
  </BrowserRouter>,
);
