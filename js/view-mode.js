const MODE_KEY = "paulaTrackerMode";
const TOKEN_KEY = "paulaTrackerViewerToken";

export function getAccessMode() {
  return sessionStorage.getItem(MODE_KEY) === "viewer" ? "viewer" : "owner";
}

export function isViewerMode() {
  return getAccessMode() === "viewer";
}

export function startViewerSession(token) {
  sessionStorage.setItem(MODE_KEY, "viewer");
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function getViewerToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function clearViewerSession() {
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
