// Vercel Serverless Function — SUBMETE o try-on (rápido, sem esperar terminar)
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

    // Apenas SUBMETE o pedido para a fila — não espera terminar
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
        garment_photo_type: 'auto',
        nsfw_filter: true,
        restore_background: true,
        restore_clothes: true,
        adjust_hands: true,
        mode: 'balanced'
      })
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      res.status(200).json({ success: false, error: 'Submit falhou ('+submitRes.status+'): ' + errText });
      return;
    }

    const submitData = await submitRes.json();
    const requestId = submitData.request_id;
    if (!requestId) {
      res.status(200).json({ success: false, error: 'Sem request_id: ' + JSON.stringify(submitData) });
      return;
    }

    // Retorna IMEDIATAMENTE com o requestId — o frontend fica perguntando o status
    res.status(200).json({ success: true, pending: true, requestId });

  } catch (e) {
    res.status(200).json({ success: false, error: e.message });
  }
};
