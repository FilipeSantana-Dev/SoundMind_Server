import spotipy
from spotipy.oauth2 import SpotifyOAuth
import webbrowser
import time

class SpotifyClient:
    def __init__(self, client_id, client_secret):
        self.client_id = client_id
        self.client_secret = client_secret

        self.oauth = SpotifyOAuth(
            client_id=self.client_id,
            client_secret=self.client_secret,
            redirect_uri="http://35.215.213.83:8080/callback",
            scope=(
                "user-read-private "
                "playlist-modify-private "
                "playlist-modify-public "
                "ugc-image-upload "
                "user-modify-playback-state "
                "user-read-playback-state "
                "streaming"
            )
        )

        self.sp = spotipy.Spotify(auth_manager=self.oauth)

    # -------------------------------------------------
    # TOKEN PARA O WEB PLAYBACK SDK
    # -------------------------------------------------
    def get_token(self):
        """Retorna um token válido para o Web Playback SDK."""
        token_info = self.oauth.get_access_token(as_dict=True)
        return token_info["access_token"]

    # -------------------------------------------------
    # PLAYLISTS
    # -------------------------------------------------
    def criar_playlist(self, nome, descricao="Gerada automaticamente"):
        user_id = self.sp.current_user()["id"]
        playlist = self.sp.user_playlist_create(
            user=user_id,
            name=nome,
            public=False,
            description=descricao
        )
        return playlist["id"]

    def buscar_recomendacoes(self, itens):
        musicas = []

        for item in itens:
            tipo = item.get("tipo")
            nome = item.get("nome")

            # Buscar artista
            if tipo == "artista":
                results = self.sp.search(q=f"artist:{nome}", type="track", limit=10)

            # Buscar música
            elif tipo == "musica":
                results = self.sp.search(q=f"track:{nome}", type="track", limit=10)

            # Buscar por gênero
            elif tipo == "genero":
                results = self.sp.search(q=f"genre:{nome}", type="track", limit=10)

            else:
                continue

            for track in results["tracks"]["items"]:
                musicas.append(track["uri"])

        return musicas

    def adicionar_musicas(self, playlist_id, musicas):
        self.sp.playlist_add_items(playlist_id, musicas)

    # -------------------------------------------------
    # TOCAR NO CLIENTE
    # -------------------------------------------------
    def tocar_playlist_web(self, playlist_id: str):
        """Abre o Web Player e inicia a playlist."""
        url = f"https://open.spotify.com/playlist/{playlist_id}"
        webbrowser.open(url)

    def iniciar_tocando_no_dispositivo(self, device_id, playlist_uri):
        """Inicia a playlist em um dispositivo do Web Playback SDK."""
        self.sp.start_playback(
            device_id=device_id,
            context_uri=playlist_uri
        )

    # -------------------------------------------------
    # OUTROS
    # -------------------------------------------------
    def deletar_playlist(self, playlist_id: str):
        """Remove a playlist da conta (unfollow)."""
        self.sp.current_user_unfollow_playlist(playlist_id)
