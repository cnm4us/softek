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
  active: (c: PoolConnection, req: Request) => Promise<Row>;
  visit: (c: PoolConnection, run: Row, req: Request) => Promise<string>;
  token: (req: Request) => string;
  checkCsrf: (req: Request, token: string) => void;
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
  active,
  visit,
  token,
  checkCsrf,
}: Context) {
  app.post('/api/feature-explorer/summary/select', async (req, res) => {
    checkCsrf(req, token(req));
    const b = z
      .object({
        requestId: uuid,
        advance: z.boolean(),
        selectionId: uuid.optional(),
      })
      .strict()
      .parse(req.body);
    const data = await transaction(async (c) => {
      const r = await active(c, req),
        v = await visit(c, r, req);
      const requestKey = `explorer-summary:${b.requestId}`;
      const render = (p: Row) => ({
        id: p.id,
        bannerId: p.banner_id,
        imageUrl: `/media/banners/${p.asset_key}`,
        title: p.title,
        altText: p.alt_text,
        destination: p.destination,
        href: getFeature(p.destination)!.href,
        campaignId: null,
      });
      const [retry] = await c.query(
        'SELECT * FROM banner_presentations WHERE user_id=? AND run_id=? AND request_key=?',
        [r.user_id, r.id, requestKey],
      );
      if (retry) return render(retry);
      if (!b.advance && b.selectionId) {
        const [saved] = await c.query(
          "SELECT * FROM banner_presentations WHERE id=? AND user_id=? AND run_id=? AND request_key LIKE 'explorer-summary:%'",
          [b.selectionId, r.user_id, r.id],
        );
        if (!saved)
          throw new HttpError(
            403,
            'That banner is not assigned to this account.',
          );
        const [current] = await c.query(
          "SELECT id FROM feature_explorer_widgets WHERE id=? AND section_key='summary' AND enabled=TRUE AND asset_key=?",
          [saved.banner_id, saved.asset_key],
        );
        if (current) return render(saved);
      }
      const widgets: Row[] = await c.query(
        "SELECT * FROM feature_explorer_widgets WHERE section_key='summary' AND enabled=TRUE AND asset_key IS NOT NULL ORDER BY sort_order,id",
      );
      if (!widgets.length) return null;
      const [cursor] = await c.query(
        'SELECT last_widget_id FROM summary_explorer_rotation WHERE user_id=?',
        [r.user_id],
      );
      const index = widgets.findIndex((w) => w.id === cursor?.last_widget_id);
      const next =
        widgets[b.advance ? (index + 1) % widgets.length : Math.max(0, index)]!;
      const feature = getFeature(next.feature_id)!,
        id = randomUUID();
      await c.query(
        'INSERT INTO banner_presentations (id,user_id,run_id,visit_id,request_key,banner_id,asset_key,title,alt_text,destination,campaign_id,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,UTC_TIMESTAMP(6))',
        [
          id,
          r.user_id,
          r.id,
          v,
          requestKey,
          next.id,
          next.asset_key,
          feature.name,
          next.alt_text,
          feature.id,
          b.advance ? 'refresh' : 'fallback',
        ],
      );
      await c.query(
        'INSERT INTO summary_explorer_rotation VALUES (?,?) ON DUPLICATE KEY UPDATE last_widget_id=VALUES(last_widget_id)',
        [r.user_id, next.id],
      );
      return render({
        id,
        banner_id: next.id,
        asset_key: next.asset_key,
        title: feature.name,
        alt_text: next.alt_text,
        destination: feature.id,
      });
    });
    res.json(data);
  });
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
  app.post('/api/admin/feature-explorer/:id/delete', async (req, res) => {
    await admin(req, true);
    const id = uuid.parse(req.params.id);
    z.object({}).strict().parse(req.body);
    await transaction(async (c) => {
      await c.query(
        'SELECT id FROM feature_explorer_widgets WHERE id=? FOR UPDATE',
        [id],
      );
      // Remove this placement only. Immutable artwork and shared catalog pages remain.
      await c.query('DELETE FROM feature_explorer_widgets WHERE id=?', [id]);
    });
    res.json({ ok: true });
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
