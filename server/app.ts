import express from 'express';
import cookieParser from 'cookie-parser';
import { router } from './routes.js';

export function createExpressApp() {
  const app = express();

  // Trust proxy for Render / Cloud Run so req.protocol and req.get('host') are accurate
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount API & OAuth routes
  app.use(router);

  return app;
}
