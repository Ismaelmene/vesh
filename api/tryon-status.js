// Vercel Serverless Function — verifica status de um try-on em andamento
// Caminho: /api/tryon-status.js

const FAL_KEY = process.env.FAL_KEY || "6d1c1d0b-cde8-4c11-acf4-c0b998aab676:9109b2a26c4f9deb248e6310315df539";

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const requestId = req.query.requestId;
  if (!requestId) {
    res.status(200).send(JSON.stringify({ success: false, done: true, error: 'requestId obrigatório' }));
    return;
  }

  try {
    const statusUrl = `https://queue.fal.run/fal-ai/fashn/tryon/v1.6/requests/${requestId}/status`;

    let statusRes;
    try {
      statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
    } catch (fetchErr) {
      res.status(200).send(JSON.stringify({ success: false, done: false, error: 'Fetch falhou: ' + fetchErr.message }));
      return;
    }

    let statusText;
    try {
      statusText = await statusRes.text();
    } catch (readErr) {
      res.status(200).send(JSON.stringify({ success: false, done: false, error: 'Erro lendo resposta: ' + readErr.message }));
      return;
    }

    if (!statusText || statusText.trim() === '') {
      res.status(200).send(JSON.stringify({ success: false, done: false, error: `Resposta vazia do fal.ai (HTTP ${statusRes.status})` }));
      return;
    }

    let status;
    try {
      status = JSON.parse(statusText);
    } catch (parseErr) {
      res.status(200).send(JSON.stringify({ success: false, done: true, error: `Status HTTP ${statusRes.status}, corpo não-JSON: ${statusText.slice(0,200)}` }));
      return;
    }

    if (status.status === 'COMPLETED') {
      const resultUrl = `https://queue.fal.run/fal-ai/fashn/tryon/v1.6/requests/${requestId}`;
      let resultRes, resultText;
      try {
        resultRes = await fetch(resultUrl, { headers: { 'Authorization': `Key ${FAL_KEY}` } });
        resultText = await resultRes.text();
      } catch (e) {
        res.status(200).send(JSON.stringify({ success: false, done: true, error: 'Erro buscando resultado: ' + e.message }));
        return;
      }

      let result;
      try { result = JSON.parse(resultText); } catch {
        res.status(200).send(JSON.stringify({ success: false, done: true, error: 'Result não-JSON: ' + resultText.slice(0,300) }));
        return;
      }

      const imageUrl = result.images?.[0]?.url || result.image?.url;
      if (imageUrl) {
        res.status(200).send(JSON.stringify({ success: true, done: true, imageUrl }));
      } else {
        res.status(200).send(JSON.stringify({ success: false, done: true, error: 'Sem imagem no result: ' + resultText.slice(0,300) }));
      }
      return;
    }

    if (status.status === 'FAILED' || status.status === 'ERROR') {
      res.status(200).send(JSON.stringify({ success: false, done: true, error: 'fal.ai status=' + status.status }));
      return;
    }

    // IN_QUEUE ou IN_PROGRESS
    res.status(200).send(JSON.stringify({ success: true, done: false, status: status.status || 'DESCONHECIDO', queuePosition: status.queue_position }));

  } catch (e) {
    res.status(200).send(JSON.stringify({ success: false, done: false, error: 'Exceção geral: ' + e.message }));
  }
};
