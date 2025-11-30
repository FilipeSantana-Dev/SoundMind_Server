/* Chat + Spotify Web Playback SDK (Minimalista - lado a lado) */

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

let player = null;
let device_id = null;
let playlist_id_atual = null;
let isPlaying = false;
let lastState = null;
let progressInterval = null;

/* --------------------------- HISTÓRICO DO CHAT --------------------------- */
let historico = [];

/* --------------------------- CHAT --------------------------- */
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
  const spotify_token = localStorage.getItem("spotify_token"); // token do usuário
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
    } else if (data.tracks_preview) {
      console.log("Preview tracks:", data.tracks_preview);
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
    const token = localStorage.getItem("spotify_token"); // Pegando o token armazenado no localStorage

    if (!token) {
      playerStatus.textContent = "não autenticado";
      return;
    }

    player = new Spotify.Player({
      name: "SoundMind Player",
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

    await player.connect();
  } catch (err) {
    playerStatus.textContent = "erro";
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
    const spotify_token = localStorage.getItem("spotify_token");
    await fetch("https://soundmindapi.online/start-playback", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ device_id, playlist_id: playlist_id_atual, spotify_token })
    });
    playerStatus.textContent = "tocando playlist";
  } catch (err) {
    playerStatus.textContent = "erro ao iniciar playback";
  }
}
