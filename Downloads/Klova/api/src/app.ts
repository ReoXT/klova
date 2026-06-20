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
import webhooksRouter from './routes/webhooks';
import customersRouter from './routes/customers';
import adminRouter from './routes/admin';

const app = express();

app.use(cors({ origin: config.frontendOrigin }));
app.use(requestLogger);

// Webhooks must receive the raw request body for HMAC signature verification.
// Mount this route BEFORE express.json() so the body stream isn't consumed first.
app.use('/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

app.use(express.json());

app.use('/health', healthRouter);
app.use('/pricing', pricingRouter);
app.use('/bookings', bookingsRouter);
app.use('/availability', availabilityRouter);
app.use('/payments', paymentsRouter);
app.use('/customers', customersRouter);
app.use('/admin', adminRouter);

app.use(errorHandler);

export default app;
