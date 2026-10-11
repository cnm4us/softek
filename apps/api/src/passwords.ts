import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      32,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [version, salt, expected] = stored.split(':');
  const key = await derive(
    password,
    salt && /^[a-f0-9]{32}$/.test(salt)
      ? salt
      : '00000000000000000000000000000000',
  );
  return (
    version === 'scrypt-v1' &&
    Boolean(expected?.match(/^[a-f0-9]{64}$/)) &&
    timingSafeEqual(key, Buffer.from(expected!, 'hex'))
  );
}
