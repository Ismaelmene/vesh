// Vercel Serverless Function — gera virtual try-on via fal.ai
// Caminho: /api/tryon.js  →  acessível em https://seusite.vercel.app/api/tryon

const FAL_KEY = process.env.FAL_KEY || "6d1c1d0b-cde8-4c11-acf4-c0b998aab676:9109b2a26c4f9deb248e6310315df539";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

    // 1. Upload da foto do usuário para o storage do fal.ai
    const blob = await fetch(fotoBase64).then(r => r.arrayBuffer());
    const uploadRes = await fetch('https://fal.run/fal-ai/storage/upload', {
      method: 'POST',
      headers: { 'Authorization': `Key ${FAL_KEY}` },
      body: Buffer.from(blob)
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      res.status(200).json({ success: false, error: 'Upload falhou: ' + errText });
      return;
    }
    const { url: modelUrl } = await uploadRes.json();

    // 2. Submete para a fila do fashn/tryon v1.6
    const submitRes = await fetch('https://queue.fal.run/fal-ai/fashn/tryon/v1.6', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_image: modelUrl,
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
      res.status(200).json({ success: false, error: 'Submit falhou: ' + errText });
      return;
    }
    const submitData = await submitRes.json();
    const requestId = submitData.request_id;
    if (!requestId) {
      res.status(200).json({ success: false, error: 'Sem request_id: ' + JSON.stringify(submitData) });
      return;
    }

    // 3. Polling do status (máximo ~25s, dentro do limite da Vercel Function)
    for (let i = 0; i < 12; i++) {
      await sleep(2000);
      const statusRes = await fetch(`https://queue.fal.run/fal-ai/fashn/tryon/v1.6/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      if (!statusRes.ok) continue;
      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(`https://queue.fal.run/fal-ai/fashn/tryon/v1.6/requests/${requestId}`, {
          headers: { 'Authorization': `Key ${FAL_KEY}` }
        });
        const result = await resultRes.json();
        const imageUrl = result.images?.[0]?.url || result.image?.url;
        if (imageUrl) {
          res.status(200).json({ success: true, imageUrl });
          return;
        }
        res.status(200).json({ success: false, error: 'Sem imagem no resultado' });
        return;
      }
      if (status.status === 'FAILED') {
        res.status(200).json({ success: false, error: 'Try-on falhou no servidor' });
        return;
      }
    }

    // Não terminou a tempo — devolve o request_id para o cliente continuar verificando
    res.status(200).json({ success: false, pending: true, requestId, error: 'Ainda processando' });

  } catch (e) {
    res.status(200).json({ success: false, error: e.message });
  }
};
