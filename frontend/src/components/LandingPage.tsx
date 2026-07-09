import { useState, useEffect } from 'react';
import {
  Phone, Mail, MapPin, Clock, Search, User, Truck, CheckCircle2,
  HeartPulse, ShieldCheck, Star, ChevronRight, Package, Baby,
  Pill, Leaf, Microscope, Sparkles, Menu, X, ArrowRight,
} from 'lucide-react';
import { useI18n, LanguageSelector } from '../shared/i18n';

interface LandingPageProps {
  onNavigateToLogin: () => void;
  pharmacyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
  };
}

// ── Logo component with graceful fallback ─────────────────────────────────────
function Logo({ logoUrl, size = 40 }: { logoUrl: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-lg shrink-0"
      >
        I
      </div>
    );
  }
  return (
    <img
      src={`http://localhost:5001${logoUrl}`}
      alt="Imana Pharmacy Logo"
      style={{ width: size, height: size }}
      className="rounded-full object-contain shrink-0 bg-white border border-gray-100"
      onError={() => setErr(true)}
    />
  );
}


// ── Main Component ────────────────────────────────────────────────────────────
export default function LandingPage({ onNavigateToLogin, pharmacyInfo }: LandingPageProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Data (translated inline) ──────────────────────────────────────────────
  const NAV_LINKS = [
    { key: 'navHome',       href: '#home' },
    { key: 'navAbout',      href: '#about-us' },
    { key: 'navServices',   href: '#services' },
    { key: 'navProducts',   href: '#our-products' },
    { key: 'navHealthTips', href: '#health-tips' },
    { key: 'navContact',    href: '#contact' },
  ] as const;

  const FEATURES = [
    { icon: <Truck size={26} className="text-teal-600" />,       titleKey: 'feat1Title', descKey: 'feat1Desc' },
    { icon: <CheckCircle2 size={26} className="text-teal-600" />, titleKey: 'feat2Title', descKey: 'feat2Desc' },
    { icon: <HeartPulse size={26} className="text-teal-600" />,  titleKey: 'feat3Title', descKey: 'feat3Desc' },
    { icon: <ShieldCheck size={26} className="text-teal-600" />, titleKey: 'feat4Title', descKey: 'feat4Desc' },
  ] as const;

  const WHY_CHOOSE = ['why1', 'why2', 'why3', 'why4', 'why5'] as const;

  const ABOUT_STATS = [
    { value: '8+',   labelKey: 'statYears' },
    { value: '5K+',  labelKey: 'statCustomers' },
    { value: '95%',  labelKey: 'statSatisfaction' },
  ] as const;

  const ABOUT_BADGES = [
    { titleKey: 'badge1Title', subKey: 'badge1Sub' },
    { titleKey: 'badge2Title', subKey: 'badge2Sub' },
    { titleKey: 'badge3Title', subKey: 'badge3Sub' },
    { titleKey: 'badge4Title', subKey: 'badge4Sub' },
  ] as const;

  const CATEGORIES = [
    { icon: <Pill size={28} className="text-blue-600" />,      bg: 'bg-blue-50',   titleKey: 'cat1', count: '2,400+' },
    { icon: <Leaf size={28} className="text-green-600" />,     bg: 'bg-green-50',  titleKey: 'cat2', count: '800+' },
    { icon: <Sparkles size={28} className="text-pink-500" />,  bg: 'bg-pink-50',   titleKey: 'cat3', count: '1,200+' },
    { icon: <Baby size={28} className="text-sky-600" />,       bg: 'bg-sky-50',    titleKey: 'cat4', count: '560+' },
    { icon: <Microscope size={28} className="text-purple-600" />, bg: 'bg-purple-50', titleKey: 'cat5', count: '340+' },
    { icon: <Package size={28} className="text-amber-500" />,  bg: 'bg-amber-50',  titleKey: 'cat6', count: '920+' },
  ] as const;

  const SERVICES = [
    { icon: <Truck size={28} className="text-teal-600" />,       titleKey: 'feat1Title', descKey: 'feat1Desc', color: 'bg-teal-50' },
    { icon: <CheckCircle2 size={28} className="text-green-600" />, titleKey: 'feat2Title', descKey: 'feat2Desc', color: 'bg-green-50' },
    { icon: <HeartPulse size={28} className="text-purple-600" />,  titleKey: 'feat3Title', descKey: 'feat3Desc', color: 'bg-purple-50' },
    { icon: <ShieldCheck size={28} className="text-orange-500" />, titleKey: 'feat4Title', descKey: 'feat4Desc', color: 'bg-orange-50' },
  ] as const;

  const PRODUCTS = [
    { badge: 'Supplements', badgeColor: 'bg-teal-600', img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=400', brand: 'NaturePlus', name: 'Vitamin D3 5000 IU' },
    { badge: 'Supplements', badgeColor: 'bg-teal-600', img: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?q=80&w=400', brand: 'PureHealth', name: 'Omega-3 Fish Oil 1000mg' },
    { badge: 'Medical Devices', badgeColor: 'bg-blue-600', img: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=400', brand: 'MediTech', name: 'Digital Blood Pressure Monitor' },
    { badge: 'Supplements', badgeColor: 'bg-teal-600', img: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?q=80&w=400', brand: 'GutBalance', name: 'Probiotic Complex 50B' },
  ];

  const HEALTH_TIPS = [
    { badge: 'Nutrition', badgeColor: 'bg-orange-500', img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400', titleKey: 'tip1Title', date: 'June 10, 2025' },
    { badge: 'Wellness',  badgeColor: 'bg-green-600',  img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=400', titleKey: 'tip2Title', date: 'May 28, 2025' },
    { badge: 'Skincare',  badgeColor: 'bg-pink-500',   img: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?q=80&w=400', titleKey: 'tip3Title', date: 'May 14, 2025' },
  ] as const;

  const TESTIMONIALS = [
    { textKey: 'test1', nameKey: 'test1Name', roleKey: 'test1Role' },
    { textKey: 'test2', nameKey: 'test2Name', roleKey: 'test2Role' },
    { textKey: 'test3', nameKey: 'test3Name', roleKey: 'test3Role' },
  ] as const;

  const FOOTER_SVCS = ['footerSvc1', 'footerSvc2', 'footerSvc3', 'footerSvc4', 'footerSvc5'] as const;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

      {/* ── Top Info Bar ───────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-gray-300 text-[11px] py-2 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1">
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <a href={`tel:${pharmacyInfo.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone size={11} /> {pharmacyInfo.phone}
            </a>
            <a href={`mailto:${pharmacyInfo.email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Mail size={11} /> {pharmacyInfo.email}
            </a>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="flex items-center gap-1.5">
              <Clock size={11} className="text-teal-400" /> {t('hours')}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={11} className="text-teal-400" /> {t('location')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Sticky Navbar ──────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 bg-white border-b transition-all duration-300 ${scrolled ? 'shadow-md border-gray-200' : 'border-gray-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Logo logoUrl={pharmacyInfo.logo_url} size={38} />
            <div className="leading-none">
              <div className="font-extrabold text-base text-gray-900 tracking-tight">IMANA</div>
              <div className="text-[10px] font-semibold text-teal-600 tracking-widest uppercase">Pharmacy</div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.key}
                href={link.href}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${i === 0 ? 'text-teal-700 font-semibold' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {t(link.key)}
              </a>
            ))}
          </nav>

          {/* Search + Language + CTA */}
          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('heroSearch')}
                className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent w-52 transition-all focus:w-64"
              />
            </div>

            {/* Language Selector – right beside Staff Login */}
            <LanguageSelector />

            <button
              onClick={onNavigateToLogin}
              className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <User size={14} /> {t('staffLogin')}
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="lg:hidden p-2 text-gray-600" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-2">
            {NAV_LINKS.map(link => (
              <a key={link.key} href={link.href} className="text-sm text-gray-700 py-2 border-b border-gray-50" onClick={() => setMobileOpen(false)}>
                {t(link.key)}
              </a>
            ))}
            <div className="flex items-center gap-3 mt-2">
              <LanguageSelector />
              <button onClick={onNavigateToLogin} className="flex-1 bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2">
                <User size={14} /> {t('staffLogin')}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <section
        id="home"
        className="relative bg-[#fdf6f0] overflow-hidden"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1587854692152-cbe660dbde88?q=80&w=1600)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#fdf6f0]/95 via-[#fdf6f0]/80 to-[#fdf6f0]/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left */}
          <div className="flex flex-col gap-6">
            <span className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full w-fit tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              {t('heroBadge')}
            </span>
            <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
              {t('heroH1Line1')}<br />
              <span className="italic text-gray-700">{t('heroH1Line2')}</span>
            </h1>
            <p className="text-base text-gray-600 max-w-md leading-relaxed">
              {t('heroDesc')}
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors shadow-md text-sm"
              >
                {t('heroServices')} <ArrowRight size={16} />
              </button>
              <a
                href={`tel:${pharmacyInfo.phone}`}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 font-semibold px-6 py-3 rounded-lg border border-gray-200 transition-colors text-sm shadow-sm"
              >
                {t('heroContact')}
              </a>
            </div>

            {/* Stats */}
            <div className="flex gap-8 mt-2">
              {ABOUT_STATS.map(s => (
                <div key={s.labelKey}>
                  <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-500">{t(s.labelKey)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right – Why Choose card */}
          <div className="hidden lg:flex justify-end">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-6 w-72 flex flex-col gap-4">
              <h3 className="text-xs font-bold text-gray-500 tracking-widest uppercase">{t('whyTitle')}</h3>
              <div className="flex flex-col gap-3">
                {WHY_CHOOSE.map((key) => (
                  <div key={key} className="flex items-center gap-3 text-sm text-gray-700">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} className="text-orange-500" />
                    </div>
                    {t(key)}
                  </div>
                ))}
              </div>
              <button
                onClick={onNavigateToLogin}
                className="mt-2 w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors text-center"
              >
                {t('contactUsToday')}
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ── Features Strip ─────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div key={i} className={`flex items-start gap-4 py-8 px-6 ${i < 3 ? 'lg:border-r border-gray-100' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">{f.icon}</div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 mb-1">{t(f.titleKey)}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{t(f.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── About Section ──────────────────────────────────────────────────── */}
      <section id="about-us" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Image */}
          <div className="relative">
            <div className="rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=800"
                alt="Pharmacy medicines"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-6 right-6 bg-teal-700 text-white rounded-2xl px-5 py-4 shadow-lg text-center">
              <div className="text-3xl font-extrabold leading-none">8+</div>
              <div className="text-xs font-semibold opacity-90 mt-1 whitespace-pre-line">{t('yearsServing')}</div>
            </div>
          </div>

          {/* Text */}
          <div className="flex flex-col gap-5">
            <div className="text-xs font-bold text-orange-600 tracking-widest uppercase">{t('aboutLabel')}</div>
            <h2 className="text-4xl font-extrabold text-gray-900 leading-tight whitespace-pre-line">{t('aboutH2')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('aboutP1')}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{t('aboutP2')}</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {ABOUT_BADGES.map((b, i) => (
                <div key={i} className="bg-blue-50 rounded-xl p-4">
                  <div className="font-bold text-sm text-gray-900">{t(b.titleKey)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t(b.subKey)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Product Categories ─────────────────────────────────────────────── */}
      <section id="our-products" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold text-orange-600 tracking-widest uppercase mb-2">{t('catLabel')}</div>
            <h2 className="text-3xl font-extrabold text-gray-900">{t('catH2')}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORIES.map((cat, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-gray-100 hover:border-teal-200 hover:shadow-md transition-all cursor-pointer bg-white group text-center">
                <div className={`w-14 h-14 rounded-2xl ${cat.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  {cat.icon}
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900 leading-snug">{t(cat.titleKey)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{cat.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services Section ───────────────────────────────────────────────── */}
      <section id="services" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold text-orange-600 tracking-widest uppercase mb-2">{t('svcLabel')}</div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">{t('svcH2')}</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">{t('svcDesc')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4 hover:shadow-lg hover:border-teal-200 transition-all">
                <div className={`w-14 h-14 ${s.color} rounded-2xl flex items-center justify-center`}>{s.icon}</div>
                <h3 className="font-bold text-base text-gray-900">{t(s.titleKey)}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Selected Products ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-xs font-bold text-orange-600 tracking-widest uppercase mb-1">{t('prodLabel')}</div>
              <h2 className="text-3xl font-extrabold text-gray-900">{t('prodH2')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('prodSub')} {pharmacyInfo.name}.</p>
            </div>
            <a href="#our-products" className="hidden sm:flex items-center gap-1 text-teal-700 text-sm font-semibold hover:underline">
              {t('prodAvail')} <ChevronRight size={14} />
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRODUCTS.map((p, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all group cursor-pointer">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={p.img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <span className={`absolute top-3 left-3 ${p.badgeColor} text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider`}>
                    {p.badge}
                  </span>
                </div>
                <div className="p-4 bg-white">
                  <div className="text-xs text-gray-400 mb-1">{p.brand}</div>
                  <div className="font-bold text-sm text-gray-900 mb-1">{p.name}</div>
                  <div className="text-xs text-gray-400">{t('prodVisit')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Health Tips ────────────────────────────────────────────────────── */}
      <section id="health-tips" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-xs font-bold text-orange-600 tracking-widest uppercase mb-1">{t('tipsLabel')}</div>
              <h2 className="text-3xl font-extrabold text-gray-900">{t('tipsH2')}</h2>
            </div>
            <a href="#health-tips" className="hidden sm:flex items-center gap-1 text-teal-700 text-sm font-semibold hover:underline">
              {t('tipsAll')} <ChevronRight size={14} />
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {HEALTH_TIPS.map((tip, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white border border-gray-100 hover:shadow-lg transition-all cursor-pointer group">
                <div className="relative aspect-video overflow-hidden">
                  <img src={tip.img} alt={t(tip.titleKey)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <span className={`absolute top-3 left-3 ${tip.badgeColor} text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider`}>
                    {tip.badge}
                  </span>
                </div>
                <div className="p-5">
                  <div className="text-xs text-gray-400 mb-2">{tip.date}</div>
                  <h3 className="font-bold text-sm text-gray-900 leading-snug">{t(tip.titleKey)}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Prescription CTA Banner ────────────────────────────────────────── */}
      <section className="py-10 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-teal-800 to-teal-600 rounded-2xl px-8 py-10 sm:py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex flex-col gap-3 text-white max-w-lg">
              <span className="inline-block bg-white/20 text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit">
                {t('rxBadge')}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight whitespace-pre-line">{t('rxH2')}</h2>
              <p className="text-sm text-teal-100 leading-relaxed">{t('rxDesc')}</p>
            </div>
            <div className="flex flex-col gap-3 shrink-0 w-full sm:w-auto">
              <a
                href={`tel:${pharmacyInfo.phone}`}
                className="flex items-center justify-center gap-2 bg-white text-teal-800 font-bold text-sm px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors shadow"
              >
                <Phone size={15} /> {t('rxCall')} {pharmacyInfo.phone}
              </a>
              <a
                href="#contact"
                className="flex items-center justify-center gap-2 bg-white/10 border border-white/30 text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-white/20 transition-colors"
              >
                <MapPin size={15} /> {t('rxFind')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold text-orange-600 tracking-widest uppercase mb-2">{t('testLabel')}</div>
            <h2 className="text-3xl font-extrabold text-gray-900">{t('testH2')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((tm, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl border border-gray-100 p-6 flex flex-col gap-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, j) => <Star key={j} size={14} className="text-orange-400 fill-orange-400" />)}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed italic">{t(tm.textKey)}</p>
                <div className="border-t border-gray-200 pt-4">
                  <div className="font-bold text-sm text-gray-900">{t(tm.nameKey)}</div>
                  <div className="text-xs text-gray-400">{t(tm.roleKey)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-gray-900 text-gray-400 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-gray-800">

            {/* Brand column */}
            <div className="flex flex-col gap-4 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <Logo logoUrl={pharmacyInfo.logo_url} size={36} />
                <div>
                  <div className="font-extrabold text-white text-base tracking-tight">IMANA</div>
                  <div className="text-[10px] font-semibold text-teal-400 tracking-widest uppercase">Pharmacy</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{t('footerDesc')}</p>
            </div>

            {/* Quick Links */}
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-white">{t('quickLinks')}</h4>
              {NAV_LINKS.map(link => (
                <a key={link.key} href={link.href} className="text-xs hover:text-teal-400 transition-colors">{t(link.key)}</a>
              ))}
            </div>

            {/* Services */}
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-white">{t('ourServices')}</h4>
              {FOOTER_SVCS.map(k => (
                <span key={k} className="text-xs">{t(k)}</span>
              ))}
            </div>

            {/* Contact */}
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-white">{t('contactDetails')}</h4>
              <div className="flex items-start gap-2 text-xs">
                <MapPin size={12} className="text-teal-500 shrink-0 mt-0.5" />
                <span>{pharmacyInfo.address}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Phone size={12} className="text-teal-500 shrink-0" />
                <a href={`tel:${pharmacyInfo.phone}`} className="hover:text-teal-400 transition-colors">{pharmacyInfo.phone}</a>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Mail size={12} className="text-teal-500 shrink-0" />
                <a href={`mailto:${pharmacyInfo.email}`} className="hover:text-teal-400 transition-colors">{pharmacyInfo.email}</a>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock size={12} className="text-teal-500 shrink-0" />
                {t('hours')}
              </div>
              <button
                onClick={onNavigateToLogin}
                className="mt-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors w-fit flex items-center gap-1.5"
              >
                <User size={12} /> {t('staffLoginPortal')}
              </button>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-600">
            <p>© {new Date().getFullYear()} {pharmacyInfo.name}. {t('allRights')}</p>
            <div className="flex gap-5">
              <span className="hover:text-gray-400 cursor-pointer transition-colors">{t('privacy')}</span>
              <span className="hover:text-gray-400 cursor-pointer transition-colors">{t('terms')}</span>
              <span className="hover:text-gray-400 cursor-pointer transition-colors">{t('support')}</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
