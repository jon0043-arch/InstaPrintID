exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    // SWITCH BETWEEN PROVIDERS — change to false to use remove.bg
    const USE_PHOTOROOM = true;

    let cleanedBase64;

    if (USE_PHOTOROOM) {
      // PhotoRoom background removal
      const imgBuffer = Buffer.from(imageBase64, 'base64');
      const formData = new FormData();
      formData.append('image_file', new Blob([imgBuffer], { type: mediaType }), 'license.jpg');

      const prRes = await fetch('https://sdk.photoroom.com/v1/segment', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.PHOTOROOM_API_KEY,
          'Accept': 'image/png, application/json'
        },
        body: formData
      });

      if (!prRes.ok) throw new Error('PhotoRoom failed: ' + prRes.status);
      const prBuffer = await prRes.arrayBuffer();
      cleanedBase64 = Buffer.from(prBuffer).toString('base64');

    } else {
      // remove.bg background removal
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
      cleanedBase64 = Buffer.from(rbgBuffer).toString('base64');
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
