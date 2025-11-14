const ytdl = require('ytdl-core');

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    res.status(400).json({ error: 'No URL provided' });
    return;
  }
  try {
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    if (!format) {
      res.status(500).json({ error: 'No audio format found' });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    ytdl(url, { format }).pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load audio' });
  }
}