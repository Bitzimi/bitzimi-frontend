import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import DownloadPage from "./DownloadPage";
import "./styles/fonts.css";
import "./styles/index.css";

const isDownload = window.location.pathname.startsWith("/download");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isDownload ? <DownloadPage /> : <App />}
  </React.StrictMode>
);
