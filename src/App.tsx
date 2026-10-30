import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { UserRole } from './types';
import { api, Session } from './services/api';
import { auth } from './firebaseConfig';

// Pages are code-split so visitors only download the screens they open
const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType<any>>>, name: K) =>
  lazy(() => loader().then(m => ({ default: m[name] })));

const Auth                     = named(() => import('./pages/Auth'), 'Auth');
const AdminAuth                = named(() => import('./pages/AdminAuth'), 'AdminAuth');
const UserDashboard            = named(() => import('./pages/UserDashboard'), 'UserDashboard');
const AdminDashboard           = named(() => import('./pages/AdminDashboard'), 'AdminDashboard');
const InstitutionDashboard     = named(() => import('./pages/InstitutionDashboard'), 'InstitutionDashboard');
const VerificationFlow         = named(() => import('./pages/VerificationFlow'), 'VerificationFlow');
const ProfilePage              = named(() => import('./pages/ProfilePage'), 'ProfilePage');
const InstitutionRegistration  = named(() => import('./pages/InstitutionRegistration'), 'InstitutionRegistration');
const OrganisationRegistration = named(() => import('./pages/OrganisationRegistration'), 'OrganisationRegistration');
const OrganisationDashboard    = named(() => import('./pages/OrganisationDashboard'), 'OrganisationDashboard');
const DocumentAuthenticityForm = named(() => import('./components/DocumentAuthenticityForm'), 'DocumentAuthenticityForm');
const QrVerifyPage             = named(() => import('./pages/QrVerifyPage'), 'QrVerifyPage');

// Scanned certificate QR codes open /v/<signed token>
const QR_PREFIX = '/v/';

// Page name ↔ URL. Components keep navigating by page name via onNavigate(page).
const PAGE_PATHS: Record<string, string> = {
  'landing':                '/',
  'login':                  '/login',
  'admin-login':            '/admin/login',
  'register-institution':   '/register/institution',
  'register-organisation':  '/register/organisation',
  'user-dashboard':         '/dashboard',
  'admin-dashboard':        '/admin',
  'institution-dashboard':  '/institution',
  'organisation-dashboard': '/organisation',
  'profile':                '/profile',
  'verification':           '/verify',
  'auth-checker':           '/similarity-checker',
};

const pathToPage = (path: string): string =>
  path.startsWith(QR_PREFIX) ? 'qr-verify' :
  Object.keys(PAGE_PATHS).find(page => PAGE_PATHS[page] === path.replace(/\/+$/, '') || (page === 'landing' && path === '/')) ?? 'landing';

const roleToPage = (role: UserRole): string => {
  if (role === UserRole.ADMIN)        return 'admin-dashboard';
  if (role === UserRole.INSTITUTION)  return 'institution-dashboard';
  if (role === UserRole.ORGANISATION) return 'organisation-dashboard';
  return 'user-dashboard'; // USER / GUEST / anything else
};

// Pages that need a session, and which roles may see them (empty = any signed-in role).
// This only shapes the UI — the backend and Firestore rules are what actually enforce access.
const PAGE_ROLES: Record<string, UserRole[]> = {
  'admin-dashboard':        [UserRole.ADMIN],
  'institution-dashboard':  [UserRole.INSTITUTION],
  'organisation-dashboard': [UserRole.ORGANISATION],
  'user-dashboard':         [],
  'verification':           [],
  'profile':                [],
};

const canView = (page: string, role: UserRole | null): boolean => {
  const allowed = PAGE_ROLES[page];
  if (!allowed) return true;          // public page
  if (!role) return false;
  return allowed.length === 0 || allowed.includes(role);
};

const Loading: React.FC<{ text?: string }> = ({ text = 'Loading…' }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gov-blue">
    <span className="text-lg font-medium">{text}</span>
  </div>
);

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = pathToPage(location.pathname);
  const pageRef = useRef(currentPage);
  pageRef.current = currentPage;

  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [userData, setUserData]             = useState<Session | null>(null);
  const [isRestoring, setIsRestoring]       = useState(true);

  const goTo = useCallback((page: string, replace = false) => {
    navigate(PAGE_PATHS[page] ?? '/', { replace });
    window.scrollTo(0, 0);
  }, [navigate]);

  // ── Restore session on load ─────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      let session: Session | null = null;
      if (user) {
        try {
          session = await api.getSession(user);
        } catch {
          session = null; // e.g. institution still pending approval
        }
      }
      setCurrentUserRole(session?.role ?? null);
      setUserData(session);

      const page = pageRef.current;
      if (!session) {
        if (!canView(page, null)) goTo('landing', true);
      } else if (['landing', 'login', 'admin-login'].includes(page) || !canView(page, session.role)) {
        // Signed in on a public/auth page (or a page for another role): go to own dashboard
        goTo(roleToPage(session.role), true);
      }
      setIsRestoring(false);
    });
    return () => unsubscribe();
  }, [goTo]);

  // ── Called by CitizenLoginForm / StandardLoginForm / AdminAuth after successful auth ─
  const handleLogin = (role: UserRole, data?: Session) => {
    setCurrentUserRole(role);
    setUserData(data ?? null);
    goTo(roleToPage(role));
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUserRole(null);
    setUserData(null);
    goTo('landing');
  };

  const dashboard = () => goTo(currentUserRole ? roleToPage(currentUserRole) : 'landing');

  // ── Page renderer ───────────────────────────────────────────────────────
  const renderPage = () => {
    if (isRestoring) return <Loading text="Loading secure session…" />;

    if (!canView(currentPage, currentUserRole)) {
      return <LandingPage onNavigate={goTo} />;
    }

    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={goTo} />;

      case 'login':
        return <Auth onLogin={handleLogin} onNavigate={goTo} />;

      case 'admin-login':
        return <AdminAuth onLogin={handleLogin} onNavigate={goTo} />;

      case 'register-institution':
        return <InstitutionRegistration onNavigate={goTo} />;

      case 'register-organisation':
        return <OrganisationRegistration onNavigate={goTo} />;

      case 'user-dashboard':
        return <UserDashboard onVerifyClick={() => goTo('verification')} />;

      case 'admin-dashboard':
        return <AdminDashboard />;

      case 'institution-dashboard':
        return <InstitutionDashboard institutionName={userData?.name} />;

      case 'profile':
        return <ProfilePage session={userData} />;

      case 'organisation-dashboard':
        return (
          <OrganisationDashboard
            organisationName={userData?.name}
            onVerifyClick={() => goTo('verification')}
          />
        );

      case 'verification':
        return (
          <div className="py-10 bg-slate-50 min-h-screen">
            <VerificationFlow onComplete={dashboard} />
          </div>
        );

      case 'qr-verify':
        return <QrVerifyPage token={decodeURIComponent(location.pathname.slice(QR_PREFIX.length))} />;

      case 'auth-checker':
        return (
          <div className="py-10 bg-slate-100 min-h-screen flex justify-center">
            <DocumentAuthenticityForm />
          </div>
        );

      default:
        return <LandingPage onNavigate={goTo} />;
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar
        onNavigate={goTo}
        currentUser={userData?.name || (currentUserRole ? 'User' : null)}
        role={currentUserRole}
        onLogout={handleLogout}
      />
      <main className="flex-grow">
        <Suspense fallback={<Loading />}>{renderPage()}</Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default App;
