exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    // Step 1: Remove background
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

    // Step 2: Claude gets precise corners + rotation from original image
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            {
              type: 'text',
              text: `Find the driver's license in this image. Return the EXACT pixel coordinates of its 4 corners and the rotation needed.

Be very precise — find the actual corners of the physical card, accounting for any perspective distortion, angle, or tilt.

Also determine: how many degrees clockwise to rotate so text reads left-to-right, right-side up (0, 90, 180, or 270).

Return ONLY raw JSON:
{
  "topLeft": {"x": 120, "y": 80},
  "topRight": {"x": 890, "y": 60},
  "bottomRight": {"x": 910, "y": 540},
  "bottomLeft": {"x": 100, "y": 560},
  "rotation": 0,
  "imageWidth": 1200,
  "imageHeight": 800
}

x/y are actual pixel coordinates in the original image. imageWidth/imageHeight are the full image dimensions.`
            }
          ]
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.[0]?.text || '{"rotation":0}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const corners = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cleanedImage: rbgBase64,
        corners,
        rotation: corners.rotation || 0
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
