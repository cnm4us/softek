import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router';
import { ArrowUpRight, Landmark, ShieldCheck, Sprout, Wallet } from 'lucide-react';
import './theme.css';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="surface card"><h2>{title}</h2>{children}</section>;
}

function Overview() {
  return <>
    <section className="intro">
      <p className="eyebrow">YOUR FINANCIAL HOME</p>
      <h1>A little clarity.<br />A lot of possibility.</h1>
      <p className="lead">Everyday banking and your next big goal, together in one place.</p>
      <Link className="button" to="/about">About this demo <ArrowUpRight size={18} aria-hidden="true" /></Link>
    </section>
    <div className="content-grid">
      <Card title="Your account overview">
        <div className="icon-circle"><Wallet aria-hidden="true" size={24} /></div>
        <p>We’re preparing your fictional accounts and recent activity.</p>
        <span className="status">Coming soon</span>
      </Card>
      <Card title="Room for your next goal">
        <div className="icon-circle"><Sprout aria-hidden="true" size={24} /></div>
        <p>A weekend away. A rainy-day cushion. Start with something that matters to you.</p>
        <span className="status">Savings goals · coming soon</span>
      </Card>
    </div>
    <p className="quiet-note"><ShieldCheck size={18} aria-hidden="true" /> A fictional experience. No real accounts or money.</p>
  </>;
}

function About() {
  return <section className="surface about">
    <p className="eyebrow">A FICTIONAL BANKING EXPERIENCE</p>
    <h1>A place to explore.</h1>
    <p className="lead">Harbor Community Bank is a fictional institution created for this demonstration.</p>
    <p>The finished experience will let you explore account information, discover optional services, and try savings goals with invented data.</p>
    <p>No real money moves, and no live bank accounts are connected.</p>
    <Link className="button" to="/">Back to overview <ArrowUpRight size={18} aria-hidden="true" /></Link>
  </section>;
}

function App() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Harbor Community Bank home">
        <span className="brand-mark"><Landmark size={24} aria-hidden="true" /></span>
        <span><strong>Harbor</strong><span className="brand-subtitle">COMMUNITY BANK</span></span>
      </Link>
      <span className="demo-badge">Fictional demo</span>
    </header>
    <div className="app-layout">
      <nav aria-label="Main navigation" className="navigation">
        <NavLink end to="/">Overview</NavLink>
        <NavLink to="/about">About the demo</NavLink>
      </nav>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Card title="Page not found"><p>This page isn’t available.</p><Link className="button" to="/">Back to overview</Link></Card>} />
        </Routes>
      </main>
    </div>
    <footer className="site-footer">Harbor Community Bank · Fictional demonstration</footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
