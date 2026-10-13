import type { Express, Request } from 'express';
import type { Pool, PoolConnection } from 'mariadb';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { features, getFeature } from './features.js';
import {
  explorerSections,
  type ExplorerWidget,
} from './feature-explorer-config.js';
import { assetDirectory, decodeBanner, publishAsset } from './banner-assets.js';
type Row = Record<string, any>;
type Context = {
  app: Express;
  pool: Pool;
  test: boolean;
  transaction: <T>(action: (c: PoolConnection) => Promise<T>) => Promise<T>;
  admin: (
    req: Request,
    mutate?: boolean,
    multipart?: boolean,
  ) => Promise<unknown>;
};
const uuid = z.string().uuid();
const section = z.enum(explorerSections.map((s) => s.key));
const featureId = z.enum(features.map((f) => f.id));
const publicWidget = (row: Row): ExplorerWidget => {
  const feature = getFeature(row.feature_id)!;
  return {
    id: row.id,
    section: row.section_key,
    featureId: feature.id,
    title: feature.name,
    href: feature.href,
    imageUrl: row.asset_key ? `/media/banners/${row.asset_key}` : null,
    altText: row.alt_text,
    enabled: Boolean(row.enabled),
    sortOrder: row.sort_order,
  };
};
export function registerFeatureExplorer({
  app,
  pool,
  test,
  transaction,
  admin,
}: Context) {
  app.get('/api/admin/feature-explorer', async (req, res) => {
    await admin(req);
    const widgets: Row[] = await pool.query(
      'SELECT * FROM feature_explorer_widgets ORDER BY section_key,sort_order,id',
    );
    res.json({
      sections: explorerSections,
      features: features.map((f) => ({
        id: f.id,
        title: f.name,
        href: f.href,
      })),
      widgets: widgets.map(publicWidget),
    });
  });
  app.post('/api/admin/feature-explorer', async (req, res) => {
    await admin(req, true);
    const b = z.object({ section, featureId }).strict().parse(req.body);
    const id = randomUUID(),
      feature = getFeature(b.featureId)!;
    try {
      await transaction(async (c) => {
        const [order] = await c.query(
          'SELECT COALESCE(MAX(sort_order),-1)+1 AS nextOrder FROM feature_explorer_widgets WHERE section_key=?',
          [b.section],
        );
        await c.query(
          'INSERT INTO feature_explorer_widgets (id,section_key,feature_id,alt_text,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
          [
            id,
            b.section,
            b.featureId,
            `Explore ${feature.name}`,
            order.nextOrder,
          ],
        );
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new HttpError(409, 'That feature is already in this section.');
      throw error;
    }
    res.status(201).json({ id });
  });
  app.get('/api/admin/feature-explorer/:id', async (req, res) => {
    await admin(req);
    const [widget] = await pool.query(
      'SELECT * FROM feature_explorer_widgets WHERE id=?',
      [uuid.parse(req.params.id)],
    );
    if (!widget) throw new HttpError(404, 'Explore feature widget not found.');
    res.json(publicWidget(widget));
  });
  app.post('/api/admin/feature-explorer/:id/settings', async (req, res) => {
    await admin(req, true);
    const id = uuid.parse(req.params.id),
      b = z
        .object({
          altText: z.string().trim().min(1).max(180),
          enabled: z.boolean(),
          sortOrder: z.number().int().min(0).max(10000),
        })
        .strict()
        .parse(req.body);
    await transaction(async (c) => {
      const [widget] = await c.query(
        'SELECT * FROM feature_explorer_widgets WHERE id=? FOR UPDATE',
        [id],
      );
      if (!widget)
        throw new HttpError(404, 'Explore feature widget not found.');
      if (b.enabled && !widget.asset_key)
        throw new HttpError(
          400,
          'Upload a banner before enabling this widget.',
        );
      await c.query(
        'UPDATE feature_explorer_widgets SET alt_text=?,enabled=?,sort_order=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',
        [b.altText, b.enabled, b.sortOrder, id],
      );
    });
    res.json({ ok: true });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  });
  app.post(
    '/api/admin/feature-explorer/:id/image',
    async (req, _res, next) => {
      await admin(req, true, true);
      uuid.parse(req.params.id);
      next();
    },
    upload.single('image'),
    async (req, res) => {
      if (!req.file)
        throw new HttpError(400, 'Choose a JPEG, PNG, or WebP image.');
      let decoded;
      try {
        decoded = await decodeBanner(req.file.buffer);
      } catch {
        throw new HttpError(
          400,
          'Use a valid JPEG, PNG, or WebP image up to 4096 pixels per side.',
        );
      }
      const key = await publishAsset(decoded.data, test);
      try {
        await transaction(async (c) => {
          const id = uuid.parse(req.params.id);
          const [widget] = await c.query(
            'SELECT id FROM feature_explorer_widgets WHERE id=? FOR UPDATE',
            [id],
          );
          if (!widget)
            throw new HttpError(404, 'Explore feature widget not found.');
          await c.query(
            "INSERT INTO banner_assets VALUES (?,'webp',?,?,?,UTC_TIMESTAMP(6))",
            [key, decoded.info.width, decoded.info.height, decoded.data.length],
          );
          await c.query(
            'UPDATE feature_explorer_widgets SET asset_key=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',
            [key, id],
          );
        });
      } catch (error) {
        await unlink(join(assetDirectory(test), key)).catch(() => {});
        throw error;
      }
      res.status(201).json({ imageUrl: `/media/banners/${key}` });
    },
  );
}
