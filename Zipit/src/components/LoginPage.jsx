import React, { useState, useEffect } from 'react';
import InstallPrompt from './InstallPrompt';
import TermsPage from './TermsPage';
import './LoginPage.css';
import { db, supabase } from '../services/db';
import { Mail, ShieldCheck } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const DEFAULT_bgProducts = [
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/assets/products/sliding_images/jpeg/1c0db977-31ab-4d8e-abf3-d42e4a4b4632.jpg?ts=1706182142",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/16126a.jpg?ts=1690815413",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/51965a.jpg",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/16082a.jpg?ts=1697274092",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/10892a.jpg",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/478716a.jpg",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/10046a.jpg?ts=1690813959",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/358826a.jpg?ts=1690814980",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/14815a.jpg",
  "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/app/images/products/sliding_image/373656a.jpg",
];

const LoginPage = ({ onLogin }) => {
  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter OTP
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const { showToast } = useToast();
  const [bgProducts, setBgProducts] = useState(DEFAULT_bgProducts);
  const [showTerms, setShowTerms] = useState(false);
  const [appLogo, setAppLogo] = useState(() => localStorage.getItem('zipit_cached_customer_logo') || '/logo_full.png');

  useEffect(() => {
    db.branding.get().then(b => {
      if (b?.customer_logo) {
        setAppLogo(b.customer_logo);
        localStorage.setItem('zipit_cached_customer_logo', b.customer_logo);
      }
    });

    const channel = supabase.channel('customer-branding-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.00000000-0000-0000-0000-000000000001' }, (payload) => {
        if (payload.new?.address) {
          try {
            const data = JSON.parse(payload.new.address);
            if (data.customer_logo) {
              setAppLogo(data.customer_logo);
              localStorage.setItem('zipit_cached_customer_logo', data.customer_logo);
            }
          } catch (_) {}
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const prods = await db.products.getAll();
        if (prods && prods.length > 0) {
          const imgs = prods.filter(p => p.image_url).map(p => p.image_url);
          if (imgs.length > 0) {
            let finalImgs = [];
            while (finalImgs.length < 10) {
              finalImgs = [...finalImgs, ...imgs.sort(() => 0.5 - Math.random())];
            }
            setBgProducts(finalImgs.slice(0, 10));
          }
        }
      } catch (err) {
        console.error("Failed to load bg images", err);
      }
    };
    fetchImages();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        showToast(error.message || 'Google sign-in failed', 'Error');
        setLoading(false);
      }
    } catch (err) {
      console.error('Google Auth Error:', err);
      showToast(err.message || 'Could not initiate Google sign-in', 'Error');
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      showToast('Please enter a valid email address', 'Invalid Email');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ 
        email: cleanEmail,
        options: {
          shouldCreateUser: true
        }
      });
      if (error) {
        showToast("Error sending OTP: " + error.message, "Error");
      } else {
        setStep(2);
        setResendTimer(45);
        showToast(`6-digit code sent to ${cleanEmail}`, 'OTP Sent');
      }
    } catch (err) {
      showToast(err.message || 'Failed to send OTP', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ 
        email: email.trim(), 
        token: cleanOtp, 
        type: 'email' 
      });
      if (error) {
        showToast("Invalid or expired OTP: " + error.message, "Error");
      } else {
        showToast('Logged in successfully! Welcome to Zipit.', 'Success');
        onLogin();
      }
    } catch (err) {
      showToast(err.message || 'Verification error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (showTerms) {
    return <TermsPage onBack={() => setShowTerms(false)} />;
  }

  return (
    <div className="blinkit-login-page">
      <div className="login-background">
        <div className="product-grid-bg">
          <div className="grid-scroll-container">
            {bgProducts.map((src, idx) => (
              <div key={idx} className="bg-product-card">
                <img src={src} alt="" />
              </div>
            ))}
            {bgProducts.map((src, idx) => (
              <div key={`dup-${idx}`} className="bg-product-card">
                <img src={src} alt="" />
              </div>
            ))}
            {bgProducts.map((src, idx) => (
              <div key={`dup2-${idx}`} className="bg-product-card">
                <img src={src} alt="" />
              </div>
            ))}
          </div>
        </div>
        <div className="fade-overlay"></div>
      </div>

      <div className="login-content">
        <div className="logo-box">
          <div className="login-logo-container">
            <img src={appLogo} alt="Zipit Logo" className="login-logo-image" />
          </div>
        </div>

        <h1 className="main-title">India's Rural Delivery App</h1>

        <p className="sub-title">Sign in or create account in seconds</p>

        {/* 1-TAP GOOGLE SIGN-IN BUTTON */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
          <button 
            type="button" 
            className="google-signin-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{loading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          <div className="login-method-divider">
            <span>or sign in with email</span>
          </div>

          {step === 1 ? (
            <form onSubmit={handleSendEmailOtp} className="login-form">
              <div className="modern-input-group">
                <div className="email-prefix">
                  <Mail size={18} color="#FFF" />
                </div>
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="modern-continue-btn" 
                disabled={!email.includes('@') || loading}
              >
                {loading ? 'Sending OTP...' : 'Send Verification OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyEmailOtp} className="login-form">
              <p style={{ fontSize: '13px', color: '#cbd5e1', textAlign: 'center', margin: '0 0 6px 0' }}>
                Code sent to <strong style={{ color: '#F8CB46' }}>{email}</strong>{' '}
                <button 
                  type="button" 
                  onClick={() => { setStep(1); setOtp(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#F8CB46', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}
                >
                  Change
                </button>
              </p>

              <div className="modern-input-group">
                <input 
                  type="text" 
                  placeholder="••••••" 
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  disabled={loading}
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '20px', fontWeight: '800' }}
                />
              </div>
              
              <button 
                type="submit" 
                className="modern-continue-btn" 
                disabled={otp.length !== 6 || loading}
              >
                {loading ? 'Verifying OTP...' : 'Verify OTP & Continue'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                {resendTimer > 0 ? (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Resend OTP in {resendTimer}s</span>
                ) : (
                  <button 
                    type="button"
                    onClick={handleSendEmailOtp}
                    style={{ background: 'transparent', border: 'none', color: '#F8CB46', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="login-footer">
        By continuing, you agree to our{' '}
        <span 
          onClick={() => setShowTerms(true)}
          style={{ 
            textDecoration: 'underline', 
            cursor: 'pointer' 
          }}
        >
          Terms and Conditions
        </span>
      </div>
      
      <InstallPrompt />
    </div>
  );
};

export default LoginPage;
