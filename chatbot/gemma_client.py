import requests
import json

class GemmaClient:

    # ============================================================
    # 1) FUNÇÃO DE CONVERSA (chat normal)
    # ============================================================
    @staticmethod
    def conversar(historico: list[dict]) -> str:
        """Recebe o histórico e gera resposta amigável."""
        url = "http://35.215.213.83:11434/api/generate"

        # transformar histórico em texto legível
        conversa = ""
        for m in historico:
            papel = "Usuário" if m["role"] == "user" else "Assistente"
            conversa += f"{papel}: {m['content']}\n"

        prompt = (
            "Você é um assistente acolhedor, emocional e humano. "
            "Responda com empatia, de forma leve, amigável e natural.\n\n"
            f"{conversa}\n"
            "Assistente:"
        )

        data = {
            "model": "gemma",
            "prompt": prompt,
            "stream": False
        }

        resp = requests.post(url, json=data)

        if resp.status_code != 200:
            return "Erro ao falar com a IA."

        return resp.json().get("response", "")

    # ============================================================
    # 2) FUNÇÃO DE ANÁLISE PARA GERAR PLAYLIST
    # ============================================================
    @staticmethod
    def analisar(historico: list[dict]) -> dict:
        """Analisa histórico e retorna recomendações musicais."""
        url = "http://35.215.213.83:11434/api/generate"

        # monta texto do histórico
        msgs = ""
        for m in historico:
            papel = "usuario" if m["role"] == "user" else "assistente"
            msgs += f"{papel}: {m['content']}\n"

        prompt = (
            "Analise as mensagens abaixo e gere recomendações musicais específicas.\n"
            "Retorne APENAS um JSON no formato:\n"
            "{\n"
            '  \"sentimento\": \"\",\n'
            '  \"energia\": 0,\n'
            '  \"recomendacoes\": [\n'
            '    { \"tipo\": \"musica\"|\"artista\"|\"genero\", \"nome\": \"\" }\n'
            '  ]\n'
            "}\n\n"
            f"Mensagens:\n{msgs}"
        )

        data = {
            "model": "gemma",
            "prompt": prompt,
            "stream": False
        }

        resp = requests.post(url, json=data)

        if resp.status_code != 200:
            raise ValueError(f"Erro na API Gemma: {resp.text}")

        texto = resp.json().get("response", "")

        return GemmaClient.extract_json(texto)

    # ============================================================
    # 3) EXTRAI JSON DA RESPOSTA
    # ============================================================
    @staticmethod
    def extract_json(texto: str) -> dict:
        try:
            inicio = texto.index("{")
            fim = texto.rindex("}") + 1
            return json.loads(texto[inicio:fim])
        except Exception:
            print("==== DEBUG GEMMA ====")
            print(texto)
            print("=====================")
            raise ValueError("Não achei JSON válido na resposta do gemma.")
