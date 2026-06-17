import app from './app';
import { config } from './config';

app.listen(config.port, () => {
  console.log(`Klova API listening on port ${config.port}`);
});
