// Vercel Serverless Function — verifica status de um try-on em andamento
// Caminho: /api/tryon-status.js

const FAL_KEY = process.env.FAL_KEY || "6d1c1d0b-cde8-4c11-acf4-c0b998aab676:9109b2a26c4f9deb248e6310315df539";

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const requestId = req.query.requestId;
    if (!requestId) { res.status(400).json({ error: 'requestId obrigatório' }); return; }

    const statusRes = await fetch(`https://queue.fal.run/fal-ai/fashn/tryon/v1.6/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${FAL_KEY}` }
    });
    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/fal-ai/fashn/tryon/v1.6/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      const result = await resultRes.json();
      const imageUrl = result.images?.[0]?.url || result.image?.url;
      res.status(200).json({ success: true, done: true, imageUrl });
      return;
    }
    if (status.status === 'FAILED') {
      res.status(200).json({ success: false, done: true, error: 'Try-on falhou' });
      return;
    }
    res.status(200).json({ success: true, done: false, status: status.status });

  } catch (e) {
    res.status(200).json({ success: false, error: e.message });
  }
};
