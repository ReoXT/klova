import express from 'express';
import cors from 'cors';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import pricingRouter from './routes/pricing';

const app = express();

app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json());
app.use(requestLogger);

app.use('/health', healthRouter);
app.use('/pricing', pricingRouter);

app.use(errorHandler);

export default app;
