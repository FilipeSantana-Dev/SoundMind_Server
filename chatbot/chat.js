/* Chat + Spotify Web Playback SDK (Minimalista - lado a lado) */

/* ---------------------------
   ELEMENTS
   --------------------------- */
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

let player = null;
let device_id = null;
let playlist_id_atual = null;
let isPlaying = false;
let lastState = null;
let progressInterval = null;

/* ---------------------------
   HISTÓRICO DO CHAT
   --------------------------- */
let historico = [];

/* ---------------------------
   CHAT
   --------------------------- */
sendBtn.addEventListener("click", enviar);
input.addEventListener("keypress", (e) => { if (e.key === "Enter") enviar(); });

/* Botão separado, sem enviar texto */
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

  fetch("http://35.215.213.83:5000/chat", {
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

/* ---------------------------
   GERAR PLAYLIST (BOTÃO)
   --------------------------- */
function gerarPlaylistDireto() {
  fetch("http://35.215.213.83:5000/gerar-playlist", {
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
    adicionarMensagem("❌ Erro ao gerar playlist.", "bot");
    console.error(err);
  });
}

/* ---------------------------
   UTIL - format time (ms -> M:SS)
   --------------------------- */
function fmt(ms){
  if (!ms && ms !== 0) return "0:00";
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const ss = String(s % 60).padStart(2,"0");
  return `${m}:${ss}`;
}

/* ---------------------------
   SDK INIT
   --------------------------- */
window.onSpotifyWebPlaybackSDKReady = async () => {
  try {
    const tokenRes = await fetch("http://35.215.213.83:5000/token");
    const tokenJson = await tokenRes.json();
    const token = tokenJson.token;

    if (!token) {
      playerStatus.textContent = "não autenticado";
      return;
    }

    player = new Spotify.Player({
      name: " SoundMind Player",
      getOAuthToken: cb => cb(token),
      volume: 0.8
    });

    player.addListener("ready", ({ device_id: id }) => {
      device_id = id;
      playerStatus.textContent = "conectado";
    });

    player.addListener("not_ready", ({ device_id }) => {
      playerStatus.textContent = "desconectado";
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
      trackArtistEl.textContent = track.artists.map(a=>a.name).join(", ");

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

    await player.connect();
  } catch (err) {
    playerStatus.textContent = "erro";
  }
};

/* ---------------------------
   START PLAYBACK
   --------------------------- */
async function iniciarPlaybackQuandoPronto() {
  if (!playlist_id_atual) return;
  if (!device_id) {
    setTimeout(iniciarPlaybackQuandoPronto, 600);
    return;
  }

  try {
    await fetch("http://35.215.213.83:5000/start-playback", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ device_id, playlist_id: playlist_id_atual })
    });
    playerStatus.textContent = "tocando playlist";
  } catch {
    playerStatus.textContent = "erro ao iniciar playback";
  }
}

/* ---------------------------
   UI helpers
   --------------------------- */
function updateCoverPlaying(playing){
  const wrap = document.querySelector(".player-cover-wrap");
  if (!wrap) return;
  if (playing) wrap.classList.add("playing");
  else wrap.classList.remove("playing");
}

function updateUIEmpty(){
  coverImg.src = "";
  trackTitleEl.textContent = "Nenhuma faixa";
  trackArtistEl.textContent = "—";
  currentTimeEl.textContent = "0:00";
  durationEl.textContent = "0:00";
  seekBar.value = 0;
}

/* ---------------------------
   CONTROLES
   --------------------------- */
playBtn.addEventListener("click", async () => {
  if (!player) return;
  if (isPlaying) await player.pause();
  else await player.resume();
});

prevBtn.addEventListener("click", async () => {
  if (!player) return;
  await player.previousTrack();
});

nextBtn.addEventListener("click", async () => {
  if (!player) return;
  await player.nextTrack();
});

/* ---------------------------
   SEEK
   --------------------------- */
seekBar.addEventListener("input", (e) => {
  if (!lastState) return;
  const pct = Number(e.target.value);
  const ms = (pct / 100) * lastState.duration;
  currentTimeEl.textContent = fmt(ms);
});

seekBar.addEventListener("change", async (e) => {
  if (!player || !lastState) return;
  const pct = Number(e.target.value);
  const ms = (pct / 100) * lastState.duration;
  await player.seek(ms);
});

/* ---------------------------
   VOLUME
   --------------------------- */
volumeBar.addEventListener("input", (e) => {
  if (!player) return;
  player.setVolume(Number(e.target.value) / 100);
});

/* ---------------------------
   SYNC DE VOLUME
   --------------------------- */
setInterval(async () => {
  if (!player) return;
  try {
    const vol = await player.getVolume();
    const volPct = Math.round(vol * 100);
    if (Number(volumeBar.value) !== volPct) {
      volumeBar.value = volPct;
    }
  } catch {}
}, 500);

updateUIEmpty();
