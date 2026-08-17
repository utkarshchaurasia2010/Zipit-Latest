import React, { useState } from 'react';
import InstallPrompt from './InstallPrompt';
import TermsPage from './TermsPage';
import './LoginPage.css';
import { db, supabase } from '../services/db';
import { Mail, ChevronRight, User, Phone, Edit2 } from 'lucide-react';
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
  const [step, setStep] = useState(() => parseInt(localStorage.getItem('login_step')) || 1);
  const [email, setEmail] = useState(() => localStorage.getItem('login_email') || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', photo: '' });
  const [bgProducts, setBgProducts] = useState(DEFAULT_bgProducts);
  const [showTerms, setShowTerms] = useState(false);

  React.useEffect(() => {
    const fetchImages = async () => {
      try {
        const prods = await db.products.getAll();
        if (prods && prods.length > 0) {
          const imgs = prods.filter(p => p.image_url).map(p => p.image_url);
          // Shuffle and pick up to 10 images to replace defaults, repeating if needed to fill space
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

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (email.includes('@')) {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        showToast("Error sending OTP: " + error.message, "Error");
      } else {
        setStep(2);
        localStorage.setItem('login_step', '2');
      }
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length === 6) {
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) {
        showToast("Invalid OTP: " + error.message, "Error");
      } else {
        localStorage.removeItem('login_step');
        localStorage.removeItem('login_email');
        onLogin();
      }
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
            <img src="/logo_full.png" alt="Zipit Logo" className="login-logo-image" />
          </div>
        </div>

        <h1 className="main-title">India's Rural Delivery App</h1>
        
        {step === 1 ? (
          <>
            <p className="sub-title">Log In or Sign Up</p>
            <form onSubmit={handleSendOtp} className="login-form">
              <div className="modern-input-group">
                <div className="email-prefix">
                  <Mail size={18} color="#FFF" />
                </div>
                <input 
                  type="email" 
                  placeholder="Enter email address" 
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    localStorage.setItem('login_email', e.target.value);
                  }}
                  autoFocus
                  disabled={loading}
                />
              </div>
              
              <button 
                type="submit" 
                className="modern-continue-btn" 
                disabled={!email.includes('@') || loading}
              >
                {loading ? 'Sending OTP...' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="sub-title" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              OTP sent to {email}
              <button 
                type="button"
                onClick={() => {
                  setStep(1);
                  localStorage.setItem('login_step', '1');
                  setOtp('');
                }}
                style={{background: 'transparent', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px'}}
              >
                Change
              </button>
            </p>
            <form onSubmit={handleVerify} className="login-form">
              <div className="modern-input-group">
                <input 
                  type="text" 
                  placeholder="Enter 6-digit OTP" 
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  disabled={loading}
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px' }}
                />
              </div>
              
              <button 
                type="submit" 
                className="modern-continue-btn" 
                disabled={otp.length < 6 || loading}
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          </>
        )}
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
