exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);
    const imgBuffer = Buffer.from(imageBase64, 'base64');

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
