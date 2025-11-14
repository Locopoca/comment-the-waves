const ytdl = require('ytdl-core');

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    res.status(400).json({ error: 'No URL provided' });
    return;
  }
  try {
    res.setHeader('Content-Type', 'audio/mpeg');
    ytdl(url, { filter: 'audioonly' }).pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}