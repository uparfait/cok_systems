/**
 * Redis Utility
 * Handles Redis operations for OTP storage with TTL
 */

const redis = require('redis');
const config = require('../configurations/config.js');

let client = null;

/**
 * Get or create Redis client
 * @returns {Promise<redis.RedisClient>}
 */
const getClient = async () => {
    if (client && client.isOpen) {
        return client;
    }

    client = redis.createClient({
        url: config.redis.url || 'redis://localhost:6379',
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    console.error('Max reconnection attempts reached');
                    return new Error('Max reconnection attempts reached');
                }
                return 1000; // Reconnect after 1 second
            }
        }
    });

    client.on('error', (err) => console.error('Redis Client Error:', err));
    client.on('connect', () => console.log('Redis connected'));
    client.on('ready', () => console.log('Redis ready'));

    await client.connect();
    return client;
};

/**
 * Store OTP in Redis with TTL
 * @param {string} key - Redis key
 * @param {string} value - OTP value
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 * @returns {Promise<boolean>}
 */
const storeOTP = async (key, value, ttl = 300) => {
    try {
        const redisClient = await getClient();
        await redisClient.setEx(key, ttl, value);
        return true;
    } catch (error) {
        console.error('Redis store OTP error:', error);
        return false;
    }
};

/**
 * Retrieve OTP from Redis
 * @param {string} key - Redis key
 * @returns {Promise<string|null>}
 */
const getOTP = async (key) => {
    try {
        const redisClient = await getClient();
        return await redisClient.get(key);
    } catch (error) {
        console.error('Redis get OTP error:', error);
        return null;
    }
};

/**
 * Delete OTP from Redis
 * @param {string} key - Redis key
 * @returns {Promise<boolean>}
 */
const deleteOTP = async (key) => {
    try {
        const redisClient = await getClient();
        await redisClient.del(key);
        return true;
    } catch (error) {
        console.error('Redis delete OTP error:', error);
        return false;
    }
};

/**
 * Store any data with TTL
 * @param {string} key - Redis key
 * @param {any} value - Value to store
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>}
 */
const setWithTTL = async (key, value, ttl) => {
    try {
        const redisClient = await getClient();
        await redisClient.setEx(key, ttl, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Redis set error:', error);
        return false;
    }
};

/**
 * Get data from Redis
 * @param {string} key - Redis key
 * @returns {Promise<any>}
 */
const get = async (key) => {
    try {
        const redisClient = await getClient();
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
};

/**
 * Delete key from Redis
 * @param {string} key - Redis key
 * @returns {Promise<boolean>}
 */
const remove = async (key) => {
    try {
        const redisClient = await getClient();
        await redisClient.del(key);
        return true;
    } catch (error) {
        console.error('Redis delete error:', error);
        return false;
    }
};

/**
 * Check if Redis is connected
 * @returns {Promise<boolean>}
 */
const isConnected = async () => {
    try {
        const redisClient = await getClient();
        await redisClient.ping();
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
const close = async () => {
    if (client && client.isOpen) {
        await client.quit();
        client = null;
    }
};

module.exports = {
    getClient,
    storeOTP,
    getOTP,
    deleteOTP,
    setWithTTL,
    get,
    remove,
    isConnected,
    close
};
