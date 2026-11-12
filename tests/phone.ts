// A pretend phone for testPage: empty storage, signed in as Mariama, with a payment sheet that ends
// however the test says. Pages given the same phone share its files, like one real phone.
import '@monimesl/dot-runtime/testing';
import { DashError } from '@monimesl/dot-runtime';

// Shared, so every order key is new: the demo server lives as long as the test file.
let uuid = 0;

export function phone(payment: () => unknown, extra: Record<string, (...args: never[]) => unknown> = {}) {
  const files: Record<string, string> = {};
  const cache: Record<string, unknown> = {};
  return {
    files,
    host: {
      'dash.crypto.randomUUID': () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`,
      'dash.system.delay': () => undefined,
      'dash.system.keepAwake': () => undefined,
      'dash.system.brightness': () => undefined,
      'dash.system.share': () => undefined,
      'dash.storage.cache.get': ({ key }: { key: string }) => cache[key] ?? null,
      'dash.storage.cache.set': ({ key, value }: { key: string; value: unknown }) => {
        cache[key] = value;
      },
      'dash.storage.file.read': ({ path }: { path: string }) => {
        if (!(path in files)) throw new DashError('missing', 'No such file');
        return files[path];
      },
      'dash.storage.file.write': ({ path, data }: { path: string; data: string }) => {
        files[path] = data;
        return { path, size: data.length };
      },
      'dash.account.signIn': () => ({ fullName: 'Mariama Kamara', alias: '+232 76 123456', accountIdToken: 'dash-1' }),
      'dash.payments.request': payment,
      ...extra,
    },
  };
}

export const momo = (status: string, value = 600000) => () => ({
  method: 'momo',
  paymentCodeId: 'pmc-test',
  reference: 'ref',
  requestId: 'req-test',
  status,
  amount: { currency: 'SLE', value },
});
