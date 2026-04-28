exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);
    const imgBuffer = Buffer.from(imageBase64, 'base64');

    // Step 1: Remove background via remove.bg
    const formData = new FormData();
    formData.append('image_file', new Blob([imgBuffer], { type: mediaType }), 'license.jpg');
    formData.append('size', 'auto');
    formData.append('format', 'png');
    formData.append('scale', 'original');
    formData.append('type', 'product');

    const rbgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY },
      body: formData
    });
    if (!rbgRes.ok) throw new Error('remove.bg failed: ' + rbgRes.status);
    const rbgBuffer = await rbgRes.arrayBuffer();
    const cleanedBase64 = Buffer.from(rbgBuffer).toString('base64');

    // Step 2: Claude validates the cleaned image
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
              source: { type: 'base64', media_type: 'image/png', data: cleanedBase64 }
            },
            {
              type: 'text',
              text: `You are a strict quality inspector for driver's license photos used for printing.

Reject the photo if ANY of these are true:
1. The license is not perfectly flat — any visible tilt, angle, or skew at all
2. Any edge of the license is cut off or not fully visible
3. Any blurriness that makes text hard to read
4. Any glare or shadow covering text

The license must look like it was placed on a flatbed scanner — perfectly flat, perfectly square, all edges visible, sharp and clear.

If there is ANY doubt, reject it.

Reply ONLY with raw JSON:
{"pass": true}
OR
{"pass": false, "reason": "brief specific reason"}

Reason examples: "license is not flat — retake directly above", "edge is cut off", "too blurry", "glare on card"`
            }
          ]
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{"pass":true}';
    let validation = { pass: true };
    try {
      validation = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch(e) {}

    if (!validation.pass) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retake: true, reason: validation.reason || 'Photo quality too low' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleanedImage: cleanedBase64, rotation: 0 })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
