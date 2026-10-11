import sharp from 'sharp';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Connection } from 'mariadb';
import {
  assetDirectory,
  publishAsset,
} from '../../apps/api/src/banner-assets.js';

export async function seedBanners(c: Connection, test: boolean) {
  const fixtures = [
    {
      id: 'harbor-goals',
      title: 'Small steps. Bright horizons.',
      subtitle: 'Make room for what matters.',
      action: 'Explore savings goals',
      destination: 'savings-goals',
      color: '#205747',
      accent: '#c5d6af',
      campaign: 'savings-launch',
    },
    {
      id: 'harbor-bill-pay',
      title: 'More time for your everyday.',
      subtitle: 'Your bills, all in one place.',
      action: 'Explore Bill Pay',
      destination: 'bill-pay',
      color: '#314c60',
      accent: '#c4d6db',
      campaign: null,
    },
    {
      id: 'harbor-cards',
      title: 'A little peace of mind.',
      subtitle: 'Stay close to your cards.',
      action: 'Explore card tools',
      destination: 'cards',
      color: '#765c40',
      accent: '#ead7b2',
      campaign: null,
    },
  ];
  for (const [order, f] of fixtures.entries()) {
    const key = `${f.id}.webp`;
    const [exists] = await c.query('SELECT id FROM demo_banners WHERE id=?', [
      f.id,
    ]);
    const assetExists = await access(join(assetDirectory(test), key)).then(
      () => true,
      () => false,
    );
    if (exists && assetExists) continue;
    // Recreate a missing bundled file only; never overwrite an existing asset or admin settings.
    const svg = `<svg width="1200" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="400" rx="36" fill="${f.color}"/><circle cx="1130" cy="50" r="265" fill="${f.accent}" opacity=".25"/><circle cx="1090" cy="380" r="190" fill="${f.accent}" opacity=".3"/><path d="M830 330 Q 950 120 1150 100" stroke="${f.accent}" stroke-width="5" fill="none"/><circle cx="1030" cy="190" r="58" fill="${f.accent}"/><path d="M1004 190l18 19 34-43" fill="none" stroke="${f.color}" stroke-width="9" stroke-linecap="round"/><text x="60" y="80" font-family="sans-serif" font-size="20" letter-spacing="4" fill="${f.accent}">HARBOR COMMUNITY BANK</text><text x="60" y="168" font-family="sans-serif" font-size="48" font-weight="600" fill="white">${f.title}</text><text x="60" y="225" font-family="sans-serif" font-size="28" fill="${f.accent}">${f.subtitle}</text><rect x="60" y="270" width="315" height="62" rx="14" fill="${f.accent}"/><text x="85" y="310" font-family="sans-serif" font-size="24" fill="${f.color}">${f.action} →</text></svg>`;
    const { data, info } = await sharp(Buffer.from(svg))
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    await publishAsset(data, test, key);
    if (exists) continue;
    await c.query(
      "INSERT INTO banner_assets VALUES (?,'webp',?,?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE asset_key=asset_key",
      [key, info.width, info.height, data.length],
    );
    await c.query(
      'INSERT INTO demo_banners VALUES (?,?,?,?,?,TRUE,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
      [
        f.id,
        key,
        f.title,
        `${f.title} ${f.subtitle} ${f.action}.`,
        f.destination,
        order,
        f.campaign,
      ],
    );
  }
}
