// Vercel Serverless Function — analisa biotipo, formato de rosto e subtom de pele
// usando a API da Anthropic (Claude) com visão computacional
// Caminho: /api/analyze.js

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "COLE_SUA_CHAVE_ANTHROPIC_AQUI";

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).send(JSON.stringify({ error: 'Method not allowed' })); return; }

  try {
    const { fotoBase64, genero } = req.body;
    if (!fotoBase64) {
      res.status(400).send(JSON.stringify({ success: false, error: 'fotoBase64 obrigatório' }));
      return;
    }

    // Extrai o tipo de mídia e os dados base64 puros
    const match = fotoBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!match) {
      res.status(200).send(JSON.stringify({ success: false, error: 'fotoBase64 não é um Data URI válido' }));
      return;
    }
    const mediaType = match[1];
    const base64Data = match[2];

    const prompt = `Você é um consultor de imagem e moda especialista. Analise esta foto de uma pessoa ${genero === 'feminino' ? 'do gênero feminino' : 'do gênero masculino'} e identifique:

1. Formato do rosto: oval, redondo, quadrado, triangular, retangular/oblongo, ou coração
2. Formato do corpo (biotipo): para ${genero === 'feminino' ? 'mulheres: triângulo, triângulo invertido, retângulo, relógio de areia (ampulheta), ou oval' : 'homens: retangular/H, triângulo invertido (atlético), oval/redondo, ou trapézio'}
3. Subtom de pele: frio (veias azuladas, fica melhor com prata/azul/branco puro), quente (veias verdes, fica melhor com dourado/marrom/tons terrosos), ou neutro (combina com ambos)
4. Uma recomendação curta de estilo baseada nessa combinação (1-2 frases, em português)

Responda APENAS em JSON válido, sem texto antes ou depois, neste formato exato:
{"formatoRosto":"...","formatoCorpo":"...","subtomPele":"...","recomendacao":"..."}`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const responseText = await anthropicRes.text();
    let data;
    try { data = JSON.parse(responseText); } catch {
      res.status(200).send(JSON.stringify({ success: false, error: 'Resposta não-JSON da Anthropic: ' + responseText.slice(0,300) }));
      return;
    }

    if (!anthropicRes.ok) {
      res.status(200).send(JSON.stringify({ success: false, error: `Anthropic HTTP ${anthropicRes.status}: ${responseText.slice(0,300)}` }));
      return;
    }

    const textoResposta = data.content?.[0]?.text || '';
    const cleanJson = textoResposta.replace(/```json|```/g, '').trim();

    let analise;
    try {
      analise = JSON.parse(cleanJson);
    } catch {
      res.status(200).send(JSON.stringify({ success: false, error: 'IA não retornou JSON válido: ' + cleanJson.slice(0,300) }));
      return;
    }

    res.status(200).send(JSON.stringify({ success: true, analise }));

  } catch (e) {
    res.status(200).send(JSON.stringify({ success: false, error: 'Exceção: ' + e.message }));
  }
};
