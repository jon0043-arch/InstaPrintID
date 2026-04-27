exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    const imgBuffer = Buffer.from(imageBase64, 'base64');
    const formData = new FormData();
    formData.append('image', new Blob([imgBuffer], { type: mediaType }), 'license.jpg');
    formData.append('format', 'png');
    formData.append('channels', 'rgba');
    formData.append('size', 'full');

    const res = await fetch('https://api.poof.bg/v1/remove-background', {
      method: 'POST',
      headers: {
        'x-api-token': process.env.POOF_API_KEY
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Poof failed: ' + res.status + ' ' + errText);
    }

    const buffer = await res.arrayBuffer();
    const cleanedBase64 = Buffer.from(buffer).toString('base64');

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
