// Vercel Serverless Function — SUBMETE o try-on para a fila (rápido, ~1-2s)
// Caminho: /api/tryon.js

const FAL_KEY = process.env.FAL_KEY || "6d1c1d0b-cde8-4c11-acf4-c0b998aab676:9109b2a26c4f9deb248e6310315df539";

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { fotoBase64, fotoRoupaUrl } = req.body;
    if (!fotoBase64 || !fotoRoupaUrl) {
      res.status(400).json({ success: false, error: 'fotoBase64 e fotoRoupaUrl são obrigatórios' });
      return;
    }
    if (!fotoBase64.startsWith('data:image')) {
      res.status(200).json({ success: false, error: 'fotoBase64 não é um Data URI válido (deve começar com data:image)' });
      return;
    }

    const submitRes = await fetch('https://queue.fal.run/fal-ai/fashn/tryon/v1.6', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_image: fotoBase64,
        garment_image: fotoRoupaUrl,
        category: 'auto',
        mode: 'performance',
        garment_photo_type: 'auto',
        moderation_level: 'permissive',
        num_samples: 1,
        segmentation_free: true,
        output_format: 'png'
      })
    });

    const submitText = await submitRes.text();
    let submitData;
    try { submitData = JSON.parse(submitText); } catch { submitData = null; }

    if (!submitRes.ok) {
      res.status(200).json({
        success: false,
        error: `Submit retornou HTTP ${submitRes.status}: ${submitText.slice(0,400)}`
      });
      return;
    }

    const requestId = submitData?.request_id;
    const statusUrl = submitData?.status_url;
    const responseUrl = submitData?.response_url;

    if (!requestId) {
      res.status(200).json({
        success: false,
        error: 'Submit OK mas sem request_id. Resposta: ' + submitText.slice(0,400)
      });
      return;
    }

    // Retorna imediatamente — o frontend vai perguntar /api/tryon-status
    // Passamos as URLs reais que o fal.ai nos deu, em vez de montar manualmente
    res.status(200).json({ success: true, pending: true, requestId, statusUrl, responseUrl });

  } catch (e) {
    res.status(200).json({ success: false, error: 'Exceção: ' + e.message });
  }
};
