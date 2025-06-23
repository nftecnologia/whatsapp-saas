import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD,
});

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

export default redis;