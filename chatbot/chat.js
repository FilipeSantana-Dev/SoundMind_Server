/* chat.js - SoundMind (atualizado para trocar botão de login Spotify) */

/* --------------------------- CONFIG --------------------------- */
const CLIENT_ID = "bb0e0bc9ddff42b782eca5a6957f22f6";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

/* --------------------------- ELEMENTS --------------------------- */
const msgs = document.getElementById("msgs");
const input = document.getElementById("texto");
const sendBtn = document.getElementById("sendBtn");

const coverImg = document.getElementById("cover");
const trackTitleEl = document.getElementById("track-title");
const trackArtistEl = document.getElementById("track-artist");
const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const seekBar = document.getElementById("seekBar");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const volumeBar = document.getElementById("volumeBar");
const playerStatus = document.getElementById("playerStatus");
const loginBtn = document.getElementById("spotifyLoginBtn");

let player = null;
let device_id = null;
let playlist_id_atual = null;
let isPlaying = false;
let lastState = null;
let progressInterval = null;

/* --------------------------- HISTÓRICO DO CHAT --------------------------- */
let historico = [];

/* --------------------------- HELPERS --------------------------- */
function fmt(ms) {
  if (!ms && ms !== 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function updateCoverPlaying(isPlayingFlag) {
  const el = document.getElementById("cover");
  if (!el) return;
  if (isPlayingFlag) el.classList.add("playing");
  else el.classList.remove("playing");
}

function updateUIEmpty() {
  coverImg.src = "";
  trackTitleEl.textContent = "Nenhuma faixa";
  trackArtistEl.textContent = "—";
  playBtn.innerHTML = "▶";
  playerStatus.textContent = "player desconectado";
}

/* --------------------------- TOKEN MANAGEMENT --------------------------- */
async function refreshAccessToken() {
  const refresh_token = localStorage.getItem("spotify_refresh");
  if (!refresh_token) return null;

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      client_id: CLIENT_ID
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!res.ok) {
      console.warn("Falha ao renovar token:", await res.text());
      localStorage.removeItem("spotify_token");
      localStorage.removeItem("spotify_refresh");
      localStorage.removeItem("spotify_expires");
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem("spotify_token", data.access_token);
      const expires = (data.expires_in || 3600) * 1000;
      localStorage.setItem("spotify_expires", Date.now() + expires);
      if (data.refresh_token) {
        localStorage.setItem("spotify_refresh", data.refresh_token);
      }
      return data.access_token;
    }
    return null;

  } catch (err) {
    console.error("Erro ao renovar token", err);
    return null;
  }
}

async function getValidAccessToken() {
  let token = localStorage.getItem("spotify_token");
  const expires = Number(localStorage.getItem("spotify_expires") || 0);

  if (!token || Date.now() + 60_000 > expires) {
    const refreshed = await refreshAccessToken();
    if (refreshed) token = refreshed;
    else return null;
  }
  return token;
}

/* --------------------------- CHAT --------------------------- */
sendBtn.addEventListener("click", enviar);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") enviar();
});

const genBtn = document.getElementById("genBtn");
genBtn.addEventListener("click", gerarPlaylistDireto);

function adicionarMensagem(texto, tipo) {
  const div = document.createElement("div");
  div.classList.add("msg", tipo === "user" ? "user" : "bot");
  div.textContent = texto;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function enviar() {
  const texto = input.value.trim();
  if (!texto) return;

  adicionarMensagem(texto, "user");
  historico.push({ role: "user", content: texto });

  input.value = "";

  fetch("https://soundmindapi.online/chat", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ historico })
  })
  .then(res => res.json())
  .then(data => {
    adicionarMensagem(data.resposta || "Sem resposta", "bot");
    historico.push({ role: "bot", content: data.resposta });

    if (data.playlist) {
      playlist_id_atual = data.playlist;
      iniciarPlaybackQuandoPronto();
    }
  })
  .catch(err => {
    adicionarMensagem("❌ Erro ao conectar ao servidor.", "bot");
    console.error(err);
  });
}

/* --------------------------- GERAR PLAYLIST (BOTÃO) --------------------------- */
function gerarPlaylistDireto() {
  const spotify_token = localStorage.getItem("spotify_token");
  fetch("https://soundmindapi.online/gerar-playlist", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ historico, spotify_token })
  })
  .then(res => res.json())
  .then(data => {
    adicionarMensagem(data.resposta || "Sem resposta", "bot");
    historico.push({ role: "bot", content: data.resposta });

    if (data.playlist) {
      playlist_id_atual = data.playlist;
      iniciarPlaybackQuandoPronto();
    }
  })
  .catch(err => {
    adicionarMensagem("❌ Erro ao gerar playlist.", "bot");
    console.error(err);
  });
}

/* --------------------------- SDK INIT --------------------------- */
window.onSpotifyWebPlaybackSDKReady = async () => {
  try {
    const token = await getValidAccessToken();
    if (!token) {
      playerStatus.textContent = "não autenticado";
      resetLoginButton();
      return;
    }

    updateLoginButtonConnected();

    player = new Spotify.Player({
      name: "SoundMind Player",
      getOAuthToken: async cb => {
        const t = await getValidAccessToken();
        cb(t || "");
      },
      volume: 0.8
    });

    player.addListener("ready", async ({ device_id: id }) => {
      device_id = id;

      playerStatus.textContent = "conectado";
      updateLoginButtonConnected();

      console.log("Player pronto, device_id =", device_id);

      const access_token = await getValidAccessToken();
      if (!access_token) {
        playerStatus.textContent = "não autenticado";
        resetLoginButton();
        return;
      }

      try {
        await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            device_ids: [device_id],
            play: false
          })
        });
        console.log("Device ativado.");
      } catch (err) {
        console.warn("Falha ao ativar device:", err);
      }
    });

    player.addListener("not_ready", () => {
      playerStatus.textContent = "desconectado";
      resetLoginButton();
    });

    player.addListener("player_state_changed", state => {
      lastState = state;
      clearInterval(progressInterval);

      if (!state) {
        isPlaying = false;
        updateUIEmpty();
        return;
      }

      const track = state.track_window.current_track;
      coverImg.src = track.album.images[0]?.url || "";
      trackTitleEl.textContent = track.name || "—";
      trackArtistEl.textContent = track.artists.map(a => a.name).join(", ");

      isPlaying = !state.paused;
      playBtn.innerHTML = isPlaying ? "⏸" : "▶";
      updateCoverPlaying(isPlaying);

      const pos = state.position;
      const dur = state.duration;

      currentTimeEl.textContent = fmt(pos);
      durationEl.textContent = fmt(dur);
      seekBar.value = dur ? (pos / dur) * 100 : 0;

      progressInterval = setInterval(() => {
        if (!lastState || lastState.paused) return;
        let newPos = lastState.position + 1000;
        if (newPos > lastState.duration) newPos = lastState.duration;

        lastState.position = newPos;
        currentTimeEl.textContent = fmt(newPos);
        seekBar.value = (newPos / lastState.duration) * 100;
      }, 1000);
    });

    playBtn.addEventListener("click", async () => {
      if (!player) return;
      try {
        if (isPlaying) await player.pause();
        else await player.resume();
      } catch (e) { console.error(e); }
    });

    prevBtn.addEventListener("click", async () => { if (player) await player.previousTrack(); });
    nextBtn.addEventListener("click", async () => { if (player) await player.nextTrack(); });

    await player.connect();
  } catch (err) {
    console.error(err);
    playerStatus.textContent = "erro";
    resetLoginButton();
  }
};

/* --------------------------- START PLAYBACK --------------------------- */
async function iniciarPlaybackQuandoPronto() {
  if (!playlist_id_atual) return;

  if (!device_id) {
    setTimeout(iniciarPlaybackQuandoPronto, 600);
    return;
  }

  try {
    const spotify_token = await getValidAccessToken();
    if (!spotify_token) {
      playerStatus.textContent = "precisa autenticar";
      return;
    }

    await fetch("https://api.spotify.com/v1/me/player/play?device_id=" + device_id, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${spotify_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        context_uri: `spotify:playlist:${playlist_id_atual}`
      })
    });

    playerStatus.textContent = "tocando playlist";
  } catch (err) {
    console.error("Erro ao iniciar playback:", err);
    playerStatus.textContent = "erro ao iniciar playback";
  }
}

/* --------------------------- LOGIN BUTTON HANDLER --------------------------- */
function updateLoginButtonConnected() {
  if (!loginBtn) return;
  loginBtn.textContent = "Conectado ao Spotify";
  loginBtn.classList.add("connected");
  loginBtn.style.pointerEvents = "none";
  loginBtn.removeAttribute("onclick");
}

function resetLoginButton() {
  if (!loginBtn) return;
  loginBtn.textContent = "Login com Spotify";
  loginBtn.classList.remove("connected");
  loginBtn.style.pointerEvents = "auto";
  loginBtn.setAttribute("onclick", "loginSpotify()");
}
