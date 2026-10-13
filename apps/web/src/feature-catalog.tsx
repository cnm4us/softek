import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Compass,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { getFeature, type FeatureId } from '../../api/src/features';
import { Card } from './ui';

const groups = [
  {
    id: 'save',
    title: 'Save & Invest',
    icon: TrendingUp,
    features: ['savings', 'easyvest-auto', 'easyvest-choice', 'easycoin'],
  },
  {
    id: 'borrow',
    title: 'Borrow & Manage Payments',
    icon: Wallet,
    features: ['bnpl', 'auto-loan', 'skip-pay'],
  },
  {
    id: 'move',
    title: 'Move Money',
    icon: ArrowLeftRight,
    features: ['instant-pay'],
  },
  {
    id: 'protect',
    title: 'Protect & Understand',
    icon: ShieldCheck,
    features: ['credit-monitor', 'identity-protect'],
  },
  {
    id: 'family',
    title: 'Family & Business',
    icon: Users,
    features: ['youth-banking', 'business-invoice'],
  },
] satisfies {
  id: string;
  title: string;
  icon: typeof Wallet;
  features: FeatureId[];
}[];

export function FeatureCatalog() {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase();
  const matches = groups.map((group) => ({
    ...group,
    products: group.features
      .map((id) => getFeature(id)!)
      .filter((feature) => feature.name.toLocaleLowerCase().includes(term)),
  }));
  const total = matches.reduce(
    (count, group) => count + group.products.length,
    0,
  );
  return (
    <Card className="feature-catalog">
      <div className="catalog-intro">
        <Compass size={22} aria-hidden="true" />
        <p>Discover services available through your financial institution.</p>
        <button
          className="menu-button"
          aria-label={searchOpen ? 'Close feature search' : 'Search features'}
          aria-expanded={searchOpen}
          aria-controls="catalog-search"
          onClick={() => {
            setSearchOpen(!searchOpen);
            setQuery('');
          }}
        >
          {searchOpen ? <X size={20} /> : <Search size={20} />}
        </button>
      </div>
      {searchOpen && (
        <div id="catalog-search" className="catalog-search">
          <label htmlFor="feature-search">Search services</label>
          <div>
            <input
              id="feature-search"
              type="search"
              autoFocus
              value={query}
              placeholder="Search by service name"
              onChange={(event) => {
                setQuery(event.target.value);
                setCollapsed([]);
              }}
            />
            {query && (
              <button className="text-button" onClick={() => setQuery('')}>
                Clear search
              </button>
            )}
          </div>
          <p className="small-note" role="status">
            {total} {total === 1 ? 'service' : 'services'} found
          </p>
        </div>
      )}
      <div className="catalog-groups">
        {matches
          .filter((group) => group.products.length > 0)
          .map((group) => {
            const open = !collapsed.includes(group.id);
            const Icon = group.icon;
            return (
              <section
                className="catalog-group"
                key={group.id}
                aria-labelledby={`catalog-${group.id}-title`}
              >
                <h2 id={`catalog-${group.id}-title`}>
                  <button
                    aria-expanded={open}
                    aria-controls={`catalog-${group.id}-links`}
                    onClick={() => {
                      setCollapsed(
                        open
                          ? [...collapsed, group.id]
                          : collapsed.filter((id) => id !== group.id),
                      );
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{group.title}</span>
                    <small aria-label={`${group.products.length} services`}>
                      {group.products.length}
                    </small>
                    <ChevronDown
                      size={18}
                      className={open ? 'rotated' : ''}
                      aria-hidden="true"
                    />
                  </button>
                </h2>
                <div id={`catalog-${group.id}-links`} hidden={!open}>
                  {group.products.map((feature) => (
                    <Link
                      key={feature.id}
                      to={feature.href}
                      state={{ fromCatalog: true }}
                    >
                      <span>{feature.name}</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        {total === 0 && (
          <p className="catalog-empty">
            No services match “{query}”. Try another service name.
          </p>
        )}
      </div>
      <p className="small-note catalog-note">
        Product visibility, descriptions and application options would be
        configured separately by each FI.
      </p>
    </Card>
  );
}
