// Vercel Serverless Function — busca produtos na Shopee Affiliate API
// Caminho: /api/shopee.js  →  acessível em https://seusite.vercel.app/api/shopee

const crypto = require('crypto');

const SHOPEE_APP_ID = process.env.SHOPEE_APP_ID || "18324001133";
const SHOPEE_SECRET = process.env.SHOPEE_SECRET || "WNBWAOMB6C6YUT7BV37MIDYHDKJEEAYQ";
const SHOPEE_API_URL = "https://open-api.affiliate.shopee.com.br/graphql";

function gerarAssinatura(appId, timestamp, payload, secret) {
  const base = appId + timestamp + payload + secret;
  return crypto.createHash('sha256').update(base).digest('hex');
}

module.exports = async function handler(req, res) {
  // CORS — permite chamadas do seu site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const keyword = (req.method === 'GET' ? req.query.keyword : req.body?.keyword) || 'camisa masculina';
    const limit = parseInt((req.method === 'GET' ? req.query.limit : req.body?.limit)) || 9;

    const query = `{
      productOfferV2(keyword: "${keyword}", listType: 1, sortType: 2, page: 1, limit: ${limit}) {
        nodes {
          itemId
          productName
          price
          imageUrl
          shopName
          commissionRate
          offerLink
          productLink
          ratingStar
          sales
        }
      }
    }`;

    const payload = JSON.stringify({ query });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = gerarAssinatura(SHOPEE_APP_ID, timestamp, payload, SHOPEE_SECRET);

    const shopeeRes = await fetch(SHOPEE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256 Credential=${SHOPEE_APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
      },
      body: payload
    });

    const data = await shopeeRes.json();

    if (data.errors) {
      res.status(200).json({ success: false, error: data.errors[0]?.message || 'Erro na API Shopee', raw: data });
      return;
    }

    const produtos = (data.data?.productOfferV2?.nodes || []).map(p => ({
      id: p.itemId,
      nome: p.productName,
      preco: 'R$ ' + parseFloat(p.price).toFixed(2).replace('.', ','),
      precoNum: parseFloat(p.price),
      foto: p.imageUrl,
      store: 'Shopee',
      storeClass: 'store-shopee',
      link: p.offerLink || p.productLink,
      comissao: p.commissionRate,
      avaliacao: p.ratingStar,
      vendas: p.sales
    }));

    res.status(200).json({ success: true, produtos });

  } catch (e) {
    res.status(200).json({ success: false, error: e.message });
  }
};
