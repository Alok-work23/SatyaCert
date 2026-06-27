import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { Auth } from './pages/Auth';
import { AdminAuth } from './pages/AdminAuth';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { InstitutionDashboard } from './pages/InstitutionDashboard';
import { VerificationFlow } from './pages/VerificationFlow';
import { ProfilePage } from './pages/ProfilePage';
import { InstitutionRegistration } from './pages/InstitutionRegistration';
import { OrganisationRegistration } from './pages/OrganisationRegistration';
import { OrganisationDashboard } from './pages/OrganisationDashboard';
import { DocumentAuthenticityForm } from './components/DocumentAuthenticityForm';
import { UserRole } from './types';
import { api } from './services/api';
import { auth } from './firebaseConfig';

const roleToPage = (role: UserRole): string => {
  if (role === UserRole.ADMIN)        return 'admin-dashboard';
  if (role === UserRole.INSTITUTION)  return 'institution-dashboard';
  if (role === UserRole.ORGANISATION) return 'organisation-dashboard';
  return 'user-dashboard'; // USER / GUEST / anything else
};

const App: React.FC = () => {
  const [currentPage, setCurrentPage]       = useState('landing');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [userData, setUserData]             = useState<any>(null);
  const [isRestoring, setIsRestoring]       = useState(true);

  // ── Restore session on load ─────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const savedRole = localStorage.getItem('satyacert_role') as UserRole | null;
        if (savedRole) {
          setCurrentUserRole(savedRole);
          setUserData({
            uid:   user.uid,
            email: user.email,
            name:  user.displayName || 'User',
            id:    localStorage.getItem('satyacert_inst_id') || user.uid,
          });
          // Only redirect if user is sitting on a public/auth page
          setCurrentPage(prev => {
            if (['landing', 'login', 'admin-login'].includes(prev)) {
              return roleToPage(savedRole);
            }
            return prev; // stay where they are
          });
        }
      } else {
        setCurrentUserRole(null);
        setUserData(null);
      }
      setIsRestoring(false);
    });
    return () => unsubscribe();
  }, []); // ← empty deps: run once only, no re-subscribe loop

  // ── Called by CitizenLoginForm / StandardLoginForm after successful auth ─
  const handleLogin = (role: UserRole, data?: any) => {
    setCurrentUserRole(role);
    setUserData(data);
    localStorage.setItem('satyacert_role', role);
    if (data?.id && role === UserRole.INSTITUTION) {
      localStorage.setItem('satyacert_inst_id', data.id);
    }
    setCurrentPage(roleToPage(role));
  };

  const handleLogout = async () => {
    await api.logout();
    localStorage.removeItem('satyacert_role');
    localStorage.removeItem('satyacert_inst_id');
    setCurrentUserRole(null);
    setUserData(null);
    setCurrentPage('landing');
  };

  // ── Page renderer ───────────────────────────────────────────────────────
  const renderPage = () => {
    if (isRestoring) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gov-blue">
          <span className="text-lg font-medium">Loading secure session…</span>
        </div>
      );
    }

    switch (currentPage) {
      case 'landing':
        return <LandingPage onNavigate={setCurrentPage} />;

      case 'login':
        return <Auth onLogin={handleLogin} onNavigate={setCurrentPage} />;

      case 'admin-login':
        return <AdminAuth onLogin={handleLogin} onNavigate={setCurrentPage} />;

      case 'register-institution':
        return <InstitutionRegistration onNavigate={setCurrentPage} />;

      case 'register-organisation':
        return <OrganisationRegistration onNavigate={setCurrentPage} />;

      case 'user-dashboard':
        return (
          <UserDashboard
            onVerifyClick={() => setCurrentPage('verification')}
            userId={userData?.uid}
          />
        );

      case 'admin-dashboard':
        return <AdminDashboard />;

      case 'institution-dashboard':
        return (
          <InstitutionDashboard
            institutionName={userData?.name}
            institutionId={userData?.id}
          />
        );

      case 'profile':
        return <ProfilePage />;

      case 'organisation-dashboard':
        return <OrganisationDashboard organisationId={userData?.id} />;

      case 'verification':
        return (
          <div className="py-10 bg-slate-50 min-h-screen">
            <VerificationFlow
              onComplete={() => setCurrentPage('user-dashboard')}
            />
          </div>
        );

      case 'auth-checker':
        return (
          <div className="py-10 bg-slate-100 min-h-screen flex justify-center">
            <DocumentAuthenticityForm />
          </div>
        );

      default:
        return <LandingPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar
        onNavigate={setCurrentPage}
        currentUser={userData?.name || (currentUserRole ? 'User' : null)}
        role={currentUserRole}
        onLogout={handleLogout}
      />
      <main className="flex-grow">{renderPage()}</main>
      <Footer />
    </div>
  );
};

export default App;