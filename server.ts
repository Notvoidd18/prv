import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import { createExpressApp } from './server/app.js';

dotenv.config();

const app = createExpressApp();
const PORT = process.env.PORT || 3000;
const distPath = path.resolve(process.cwd(), 'dist');

// Serve static frontend in production
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`EduDrive Server running on http://0.0.0.0:${PORT}`);
});
