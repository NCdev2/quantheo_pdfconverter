import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: true }));
app.use(express.json());
app.use(morgan('tiny'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'StirlingPDF API', uptime: process.uptime() });
});

app.get('/info', (_req, res) => {
  res.json({ name: 'StirlingPDF API', version: '1.0.0', documentation: '/docs' });
});

app.post('/convert', (req, res) => {
  return res.status(501).json({
    message: 'PDF conversion is not implemented yet. Deploy your backend and replace this placeholder with your PDF processing stack.',
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`StirlingPDF API listening on http://localhost:${PORT}`);
});
