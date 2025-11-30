// login.js (coloque dentro de /public)
async function base64urlencode(str) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64urlencode(array);
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlencode(digest);
}

async function loginSpotify() {
  const client_id = "bb0e0bc9ddff42b782eca5a6957f22f6";
  const redirect_uri = "https://soundmind.vercel.app/callback.html";
  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "playlist-modify-private",
    "playlist-modify-public"
  ].join(" ");

  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("spotify_code_verifier", verifier);

  const url =
    "https://accounts.spotify.com/authorize" +
    `?client_id=${client_id}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&code_challenge=${challenge}` +
    `&code_challenge_method=S256`;

  window.location.href = url;
}
