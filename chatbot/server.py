from flask import Flask, request, jsonify
from flask_cors import CORS
from gemma_client import GemmaClient
from spotify_client import SpotifyClient

SPOTIFY_CLIENT_ID = "bb0e0bc9ddff42b782eca5a6957f22f6"
SPOTIFY_CLIENT_SECRET = "631a6d311faf46e289006f4d9ce916f3"

app = Flask(__name__)
CORS(app)

spotify = SpotifyClient(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)


# -----------------------------------------------------
#  ROTA PRINCIPAL DE CONVERSA
# -----------------------------------------------------
@app.post("/chat")
def chat():
    data = request.get_json()
    historico = data.get("historico", [])

    if not historico:
        return jsonify({"erro": "Histórico ausente"}), 400

    try:
        resposta = GemmaClient.conversar(historico)
    except Exception as e:
        return jsonify({"erro": "Falha no Gemma", "detalhe": str(e)}), 500

    return jsonify({
        "resposta": resposta,
        "playlist": None
    })


# -----------------------------------------------------
#  ROTA PARA GERAR PLAYLIST (BOTÃO)
# -----------------------------------------------------
@app.post("/gerar-playlist")
def gerar_playlist():
    data = request.get_json()
    historico = data.get("historico", [])

    if not historico:
        return jsonify({"erro": "Histórico vazio"}), 400

    # Analisar preferências
    try:
        analise = GemmaClient.analisar(historico)
    except Exception as e:
        return jsonify({"erro": "Erro ao analisar conversa", "detalhe": str(e)}), 500

    recomendacoes = analise.get("recomendacoes", [])
    if not recomendacoes:
        return jsonify({
            "resposta": "Analisei tudo, mas não encontrei estilos ou emoções suficientes para criar uma playlist 😥",
            "playlist": None
        })

    # Buscar músicas
    try:
        musicas = spotify.buscar_recomendacoes(recomendacoes)
    except Exception as e:
        return jsonify({"erro": "Erro no Spotify", "detalhe": str(e)}), 500

    if not musicas:
        return jsonify({
            "resposta": "Encontrei perfis emocionais, mas nenhuma música combinou 😔",
            "playlist": None
        })

    # Criar playlist
    try:
        playlist_id = spotify.criar_playlist("Playlist Gerada pela IA")
        spotify.adicionar_musicas(playlist_id, musicas)

        # Deletar para ficar invisível (apenas para tocar pelo device_id)
        spotify.deletar_playlist(playlist_id)
    except Exception as e:
        return jsonify({"erro": "Erro ao criar playlist", "detalhe": str(e)}), 500

    return jsonify({
        "resposta": "Sua playlist personalizada está pronta 🎵💙",
        "playlist": playlist_id
    })


# -----------------------------------------------------
# TOKEN PARA O PLAYER WEB
# -----------------------------------------------------
@app.get("/token")
def token():
    token = spotify.get_token()
    return jsonify({"token": token})


# -----------------------------------------------------
#  INICIAR PLAYBACK NO DISPOSITIVO
# -----------------------------------------------------
@app.post("/start-playback")
def start_playback():
    data = request.get_json()
    device_id = data.get("device_id")
    playlist_id = data.get("playlist_id")

    if not device_id or not playlist_id:
        return jsonify({"erro": "Faltam parâmetros"}), 400

    try:
        spotify.iniciar_tocando_no_dispositivo(
            device_id,
            f"spotify:playlist:{playlist_id}"
        )
    except Exception as e:
        return jsonify({"erro": "Erro ao tocar playlist", "detalhe": str(e)}), 500

    return jsonify({"status": "ok"})


@app.get("/")
def home():
    return "Servidor rodando com Chat + Web Playback SDK"


if __name__ == "__main__":
    print("🔥 Servidor ativo em http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
