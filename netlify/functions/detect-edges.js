exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            {
              type: 'text',
              text: `Analyze this image of a driver's license or ID card.

Find the 4 corners of the license/ID card only (not the background).
Also determine the correct orientation — is the card rotated 0, 90, 180, or 270 degrees from normal horizontal reading orientation?

Return ONLY raw JSON, no markdown, no explanation:
{
  "topLeft": {"x": 0.1, "y": 0.1},
  "topRight": {"x": 0.9, "y": 0.1},
  "bottomRight": {"x": 0.9, "y": 0.9},
  "bottomLeft": {"x": 0.1, "y": 0.9},
  "rotation": 0
}

rotation must be 0, 90, 180, or 270 — the degrees needed to rotate the extracted card so text reads normally left-to-right.
All x/y values are fractions 0-1 relative to image dimensions.
If no card found: {"error": "not found"}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{"error":"no response"}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
