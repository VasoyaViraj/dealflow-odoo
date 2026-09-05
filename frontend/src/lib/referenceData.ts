import api from './api';
import type { Product } from '../types/quotation';
import type { SubscriptionPlan } from '../types/billing';

const TTL_MS = 60_000;

interface CacheEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.promise;

  const promise = loader().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: now + TTL_MS, promise });
  return promise;
}

export function getProducts(): Promise<Product[]> {
  return cached('products', async () => {
    const response = await api.get('/products');
    return response.data.data;
  });
}

export function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return cached('subscription-plans', async () => {
    const response = await api.get('/products/subscription-plans');
    return response.data.data;
  });
}

export function clearReferenceDataCache() {
  cache.clear();
}
