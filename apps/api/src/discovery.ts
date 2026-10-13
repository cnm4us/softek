import type { Express, Request } from 'express';
import type { PoolConnection } from 'mariadb';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from './errors.js';
import { customerContext } from './customer-context.js';
import { getFeature } from './features.js';
import {
  discoveryContexts,
  discoveryInvitations,
  discoveryPolicy,
  suppressionReason,
} from './discovery-config.js';
type Row = Record<string, any>;
type Context = {
  app: Express;
  transaction: <T>(action: (c: PoolConnection) => Promise<T>) => Promise<T>;
  active: (c: PoolConnection, req: Request) => Promise<Row>;
  visit: (c: PoolConnection, run: Row, req: Request) => Promise<string>;
  token: (req: Request) => string;
  checkCsrf: (req: Request, token: string) => void;
  admin: (req: Request) => Promise<unknown>;
};
const uuid = z.string().uuid();
export function registerDiscovery({
  app,
  transaction,
  active,
  visit,
  token,
  checkCsrf,
  admin,
}: Context) {
  async function preferences(c: PoolConnection, user: string) {
    const [p] = await c.query(
      'SELECT * FROM discovery_preferences WHERE user_id=?',
      [user],
    );
    return {
      optOut: Boolean(p?.opt_out),
      fewerSuggestions: Boolean(p?.fewer_suggestions),
    };
  }
  app.get('/api/discovery/preferences', async (req, res) => {
    res.json(
      await transaction(async (c) => {
        const r = await active(c, req);
        return preferences(c, r.user_id);
      }),
    );
  });
  app.post('/api/discovery/preferences', async (req, res) => {
    checkCsrf(req, token(req));
    const p = z
      .object({ optOut: z.boolean(), fewerSuggestions: z.boolean() })
      .strict()
      .parse(req.body);
    await transaction(async (c) => {
      const r = await active(c, req);
      await c.query(
        'INSERT INTO discovery_preferences VALUES (?,?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE opt_out=VALUES(opt_out),fewer_suggestions=VALUES(fewer_suggestions),updated_at=UTC_TIMESTAMP(6)',
        [r.user_id, p.optOut, p.fewerSuggestions],
      );
    });
    res.json(p);
  });
  app.post('/api/discovery/select', async (req, res) => {
    checkCsrf(req, token(req));
    const b = z
      .object({ context: z.enum(discoveryContexts) })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        const r = await active(c, req),
          v = await visit(c, r, req);
        const pref = await preferences(c, r.user_id);
        if (pref.optOut) return { recommendation: null, reason: 'opted-out' };
        if (b.context === 'loan-personal')
          return { recommendation: null, reason: 'demo-loan-ineligible' };
        const invitation = discoveryInvitations[b.context];
        const [existing] = await c.query(
          'SELECT * FROM discovery_presentations WHERE visit_id=?',
          [v],
        );
        if (
          existing &&
          (existing.placement !== invitation.placement || existing.dismissed_at)
        )
          return { recommendation: null, reason: 'visit-cap' };
        let presentation = existing;
        if (!presentation) {
          const [history] = await c.query(
            'SELECT MAX(CASE WHEN p.feature_id=? THEN p.impressed_at END) AS impression,MAX(CASE WHEN p.feature_id=? THEN p.dismissed_at END) AS dismissal,MAX(p.impressed_at) AS any_impression FROM discovery_presentations p JOIN visit_contexts vc ON vc.visit_id=p.visit_id WHERE p.user_id=? AND vc.activity_source=?',
            [
              invitation.featureId,
              invitation.featureId,
              r.user_id,
              customerContext(req).source,
            ],
          );
          const timestamp = (at: Date | null) =>
            at ? new Date(at).getTime() : null;
          const reason = suppressionReason({
            ...pref,
            lastImpression: timestamp(history.impression),
            lastDismissal: timestamp(history.dismissal),
            lastAnyImpression: timestamp(history.any_impression),
            adopted: false,
          });
          // Current feature CTAs are confirmation-only, so no activation is inferred.
          if (reason) return { recommendation: null, reason };
          const id = randomUUID();
          await c.query(
            'INSERT INTO discovery_presentations (id,user_id,run_id,visit_id,feature_id,placement,selection_reason,policy_version,created_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))',
            [
              id,
              r.user_id,
              r.id,
              v,
              invitation.featureId,
              invitation.placement,
              invitation.reason,
              discoveryPolicy.version,
            ],
          );
          presentation = { id };
        }
        const feature = getFeature(invitation.featureId)!;
        return {
          recommendation: {
            id: presentation.id,
            ...invitation,
            href: feature.href,
            label: feature.label,
            disclosure: feature.disclosure,
          },
          reason: invitation.reason,
        };
      }),
    );
  });
  app.post('/api/discovery/observations', async (req, res) => {
    checkCsrf(req, token(req));
    const b = z
      .object({
        presentationId: uuid,
        name: z.enum(['impression', 'dismiss', 'learn-more']),
      })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        const r = await active(c, req),
          v = await visit(c, r, req);
        const [p] = await c.query(
          'SELECT * FROM discovery_presentations WHERE id=? AND user_id=? AND run_id=? AND visit_id=?',
          [b.presentationId, r.user_id, r.id, v],
        );
        if (!p)
          throw new HttpError(
            403,
            'That suggestion is not assigned to this visit.',
          );
        const pref = await preferences(c, r.user_id);
        if (pref.optOut || (p.dismissed_at && b.name !== 'dismiss'))
          return { acknowledged: false };
        const column = {
          impression: 'impressed_at',
          dismiss: 'dismissed_at',
          'learn-more': 'clicked_at',
        }[b.name];
        await c.query(
          `UPDATE discovery_presentations SET ${column}=COALESCE(${column},UTC_TIMESTAMP(6)) WHERE id=?`,
          [p.id],
        );
        return { acknowledged: true };
      }),
    );
  });
  app.get('/api/admin/discovery-report', async (req, res) => {
    await admin(req);
    const f = z
      .object({
        actor: z.enum(['human', 'automation', 'all']).default('human'),
        variant: z.enum(['baseline', 'value', 'all']).default('all'),
        start: z.iso.datetime().optional(),
        end: z.iso.datetime().optional(),
        cutoff: z.iso.datetime().optional(),
      })
      .strict()
      .parse(req.query);
    const start = new Date(f.start ?? '2000-01-01T00:00:00Z'),
      end = new Date(f.end ?? new Date().toISOString()),
      cutoff = new Date(f.cutoff ?? new Date().toISOString());
    if (start > end)
      throw new HttpError(400, 'The start date must come before the end date.');
    const rows = await transaction((c) =>
      c.query(
        "SELECT p.feature_id AS featureId,p.placement,COUNT(*) AS presentations,SUM(p.impressed_at IS NOT NULL AND p.impressed_at<=?) AS impressions,SUM(p.dismissed_at IS NOT NULL AND p.dismissed_at<=?) AS dismissals,SUM(p.clicked_at IS NOT NULL AND p.clicked_at<=?) AS clicks,COUNT(DISTINCT CASE WHEN p.impressed_at IS NOT NULL AND p.impressed_at<=? THEN p.user_id END) AS viewers,COALESCE(SUM(o.views),0) AS featureViews,COALESCE(SUM(o.ctas),0) AS featureCtas FROM discovery_presentations p JOIN participant_runs r ON r.id=p.run_id JOIN visit_contexts vc ON vc.visit_id=p.visit_id LEFT JOIN (SELECT d.presentation_id,SUM(e.name='feature_viewed') AS views,SUM(e.name='feature_cta_clicked') AS ctas FROM discovery_feature_observations d JOIN interaction_events e ON e.id=d.interaction_id WHERE e.created_at<=? GROUP BY d.presentation_id) o ON o.presentation_id=p.id WHERE vc.activity_source='customer' AND (?='all' OR r.actor=?) AND (?='all' OR r.variant=?) AND r.created_at>=? AND r.created_at<=? AND p.created_at<=? GROUP BY p.feature_id,p.placement",
        [
          cutoff,
          cutoff,
          cutoff,
          cutoff,
          cutoff,
          f.actor,
          f.actor,
          f.variant,
          f.variant,
          start,
          end,
          cutoff,
        ],
      ),
    );
    res.json({ rows });
  });
}
