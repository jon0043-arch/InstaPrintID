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

    if (!rbgRes.ok) {
      throw new Error('remove.bg failed: ' + rbgRes.status);
    }

    const rbgBuffer = await rbgRes.arrayBuffer();
    const rbgBase64 = Buffer.from(rbgBuffer).toString('base64');

    // Step 2: Ask Claude for rotation only (background already removed)
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: rbgBase64 }
            },
            {
              type: 'text',
              text: `This is a driver's license with the background removed. 
How many degrees clockwise must it be rotated so the text reads normally left-to-right and right-side up?
Return ONLY raw JSON: {"rotation": 0}
rotation must be 0, 90, 180, or 270.`
            }
          ]
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.[0]?.text || '{"rotation":0}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const { rotation } = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cleanedImage: rbgBase64,
        rotation: rotation || 0
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
