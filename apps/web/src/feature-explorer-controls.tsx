import { type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Copy, Plus, Upload } from 'lucide-react';
import {
  explorerSections,
  type ExplorerWidget,
} from '../../api/src/feature-explorer-config';
import { useResource, Feedback } from './admin-tools';
import { Card } from './ui';

type Listing = {
  features: { id: string; title: string; href: string }[];
  widgets: ExplorerWidget[];
};
export function FeatureExplorerControls() {
  const { data, loading, error, notice, busy, action, request } =
    useResource<Listing>('/admin/feature-explorer');
  const navigate = useNavigate();
  async function add(e: FormEvent<HTMLFormElement>, section: string) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    await action(async () => {
      const created = await request<{ id: string }>('/admin/feature-explorer', {
        section,
        featureId: fields.get('featureId'),
      });
      navigate(`/controls/feature-explorer/${created.id}`);
    }, 'Explore feature added.');
  }
  return (
    <div className="feature-explorer-controls">
      <Feedback error={error} notice={notice} />
      <p className="small-note">
        Add Explore features to each banner space. Customer banners are not
        rotating yet.
      </p>
      {loading ? (
        <p role="status">Loading Feature Explorer…</p>
      ) : (
        data &&
        explorerSections.map((section) => {
          const widgets = data.widgets.filter((w) => w.section === section.key);
          const available = data.features.filter(
            (f) => !widgets.some((w) => w.featureId === f.id),
          );
          return (
            <Card
              key={section.key}
              title={section.label}
              className="explorer-section"
            >
              {widgets.length ? (
                <ul className="explorer-widget-list">
                  {widgets.map((w) => (
                    <li key={w.id}>
                      <Link to={`/controls/feature-explorer/${w.id}`}>
                        {w.title}
                      </Link>
                      <span className="small-note">
                        {!w.imageUrl
                          ? 'Needs banner'
                          : w.enabled
                            ? 'Ready for rotation'
                            : 'Disabled'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small-note">No Explore features added yet.</p>
              )}
              {available.length > 0 && (
                <form
                  className="explorer-add-form"
                  onSubmit={(e) => void add(e, section.key)}
                >
                  <label>
                    Explore feature
                    <select
                      key={available.map((f) => f.id).join(',')}
                      name="featureId"
                      aria-label={`Explore feature for ${section.label}`}
                      required
                    >
                      {available.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button secondary" disabled={busy}>
                    <Plus size={16} />
                    Add Explore feature
                  </button>
                </form>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
export function ExploreWidgetControls() {
  const { widgetId } = useParams();
  const {
    data,
    loading,
    error,
    notice,
    busy,
    action,
    request,
    setError,
    setNotice,
  } = useResource<ExplorerWidget>(`/admin/feature-explorer/${widgetId}`);
  const section = explorerSections.find((s) => s.key === data?.section);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await action(async () => {
      await request(
        `/admin/feature-explorer/${widgetId}/image`,
        new FormData(form),
      );
      form.reset();
    }, 'Mobile banner uploaded.');
  }
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(
        new URL(data!.href, window.location.origin).href,
      );
      setError('');
      setNotice('Feature URL copied.');
    } catch {
      setError('Could not copy the URL. You can select and copy it below.');
    }
  }
  return (
    <div className="feature-explorer-controls">
      <Link
        className="text-button account-back"
        to="/controls/feature-explorer"
      >
        <ArrowLeft size={17} />
        Back to Feature Explorer
      </Link>
      <Feedback error={error} notice={notice} />
      {loading ? (
        <p role="status">Loading Explore feature…</p>
      ) : (
        data && (
          <>
            <Card title={data.title}>
              <p className="section-caption">Banner space: {section?.label}</p>
              <label>
                Feature URL
                <input
                  readOnly
                  value={new URL(data.href, window.location.origin).href}
                />
              </label>
              <button
                className="button secondary"
                onClick={() => void copyUrl()}
              >
                <Copy size={16} />
                Copy feature URL
              </button>
              <p className="small-note">
                The title and destination come from Explore more ways to bank.
              </p>
            </Card>
            <Card title="Mobile banner">
              <p>
                Recommended: 960 × 315 pixels for a 320 × 105 mobile space.
                JPEG, PNG or WebP; up to 5 MiB.
              </p>
              <div
                className="explorer-mobile-preview"
                aria-label="Mobile banner preview"
              >
                {data.imageUrl ? (
                  <img src={data.imageUrl} alt={data.altText} />
                ) : (
                  <span>No banner uploaded</span>
                )}
              </div>
              <form onSubmit={(e) => void upload(e)}>
                <label>
                  {data.imageUrl
                    ? 'Replace mobile banner'
                    : 'Upload mobile banner'}
                  <input
                    type="file"
                    name="image"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </label>
                <button className="button" disabled={busy}>
                  <Upload size={16} />
                  {data.imageUrl ? 'Replace banner' : 'Upload banner'}
                </button>
              </form>
            </Card>
            <Card title="Widget settings">
              <form
                key={`${data.altText}:${data.enabled}:${data.sortOrder}`}
                className="controls-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action(
                    () =>
                      request(`/admin/feature-explorer/${widgetId}/settings`, {
                        altText: f.get('altText'),
                        enabled: f.get('enabled') === 'on',
                        sortOrder: Number(f.get('sortOrder')),
                      }),
                    'Widget settings saved.',
                  );
                }}
              >
                <label>
                  Accessible link text
                  <input
                    name="altText"
                    required
                    maxLength={180}
                    defaultValue={data.altText}
                  />
                </label>
                <label>
                  Display order
                  <input
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={10000}
                    required
                    defaultValue={data.sortOrder}
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    name="enabled"
                    type="checkbox"
                    disabled={!data.imageUrl}
                    defaultChecked={data.enabled}
                  />
                  Include in future rotation
                </label>
                <button className="button secondary" disabled={busy}>
                  Save widget
                </button>
              </form>
            </Card>
          </>
        )
      )}
    </div>
  );
}
