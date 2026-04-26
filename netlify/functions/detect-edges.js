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
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: `Find the 4 corners of the driver's license or ID card in this image.
Return ONLY a JSON object with no explanation, no markdown, no backticks. Just raw JSON like this:
{"topLeft":{"x":0.1,"y":0.1},"topRight":{"x":0.9,"y":0.1},"bottomRight":{"x":0.9,"y":0.9},"bottomLeft":{"x":0.1,"y":0.9}}
All values are fractions from 0 to 1 representing position relative to image width and height.
If you cannot find a card, return: {"error":"not found"}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{"error":"no response"}';

    // Clean and parse
    const cleaned = text.replace(/```json|```/g, '').trim();
    const corners = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corners)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
