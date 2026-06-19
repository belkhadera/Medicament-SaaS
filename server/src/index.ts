import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import apiRoutes from './routes/index';
import { errorHandler, notFound } from './middleware/errorHandler';
import { startExpirationAlerts } from './jobs/expirationAlerts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

connectDB();
startExpirationAlerts().catch((err) => console.error('Failed to start expiry alerts:', err));

app.use(cors({
  origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});
