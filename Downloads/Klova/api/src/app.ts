import express from 'express';
import cors from 'cors';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import pricingRouter from './routes/pricing';
import bookingsRouter from './routes/bookings';
import availabilityRouter from './routes/availability';
import paymentsRouter from './routes/payments';

const app = express();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json());
app.use(requestLogger);

app.use('/health', healthRouter);
app.use('/pricing', pricingRouter);
app.use('/bookings', bookingsRouter);
app.use('/availability', availabilityRouter);
app.use('/payments', paymentsRouter);

app.use(errorHandler);

export default app;
