exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    // Step 1: Remove background via remove.bg
    const imgBuffer = Buffer.from(imageBase64, 'base64');
    const formData = new FormData();
    formData.append('image_file', new Blob([imgBuffer], { type: mediaType }), 'license.jpg');
    formData.append('size', 'auto');
    formData.append('format', 'png');

    const rbgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY },
      body: formData
    });

    if (!rbgRes.ok) throw new Error('remove.bg failed: ' + rbgRes.status);

    const rbgBuffer = await rbgRes.arrayBuffer();
    const rbgBase64 = Buffer.from(rbgBuffer).toString('base64');

    // Step 2: Ask Claude for rotation using the cleaned image
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: rbgBase64 }
            },
            {
              type: 'text',
              text: `This is the back of a driver's license with the background removed.

A driver's license back typically has:
- A barcode (PDF417) along the bottom or right side
- A magnetic stripe
- Small text

Determine the correct rotation so this image is right-side up and readable.

The barcode on the back of a US license is typically along the BOTTOM edge when held normally.

Return ONLY raw JSON — no explanation:
{"rotation": 0}

Valid values: 0, 90, 180, 270
- 0 = already correct
- 90 = rotate 90 degrees clockwise
- 180 = flip upside down  
- 270 = rotate 270 degrees clockwise (same as 90 counter-clockwise)`
            }
          ]
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.[0]?.text || '{"rotation":0}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    let rotation = 0;
    try { rotation = JSON.parse(cleaned).rotation || 0; } catch(e) {}

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleanedImage: rbgBase64, rotation })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
