export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Campo "text" é obrigatório' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY não configurada nas variáveis de ambiente do Vercel' });
    return;
  }

  const prompt = 'Você é um nutricionista estimando valores nutricionais aproximados de uma refeição descrita por um paciente, em linguagem informal e com quantidades aproximadas. '
    + 'Estime o total de calorias e macronutrientes para a descrição abaixo, considerando as quantidades mencionadas (ou uma porção individual comum se não houver quantidade). '
    + 'Responda APENAS com um objeto JSON válido, sem nenhum texto antes ou depois, sem markdown, no formato exato: {"kcal": numero, "p": numero, "c": numero, "f": numero} '
    + 'onde kcal é o total de calorias, p é proteína em gramas, c é carboidrato em gramas e f é gordura em gramas. '
    + 'Descrição da refeição: ' + text;

  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      res.status(geminiRes.status).json({ error: 'Erro na API do Gemini: ' + errBody });
      return;
    }

    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed.kcal !== 'number' ||
      typeof parsed.p !== 'number' ||
      typeof parsed.c !== 'number' ||
      typeof parsed.f !== 'number'
    ) {
      res.status(500).json({ error: 'Formato inesperado da resposta da IA' });
      return;
    }

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
