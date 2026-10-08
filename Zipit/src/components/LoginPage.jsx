import React, { useState, useEffect } from 'react';
import InstallPrompt from './InstallPrompt';
import TermsPage from './TermsPage';
import './LoginPage.css';
import { db, supabase } from '../services/db';
import { Mail, ShieldCheck, ArrowLeft, MessageSquare, Sparkles } from 'lucide-react';
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

  const [loginMethod, setLoginMethod] = useState('whatsapp'); // 'whatsapp' | 'email'
  const [waRequest, setWaRequest] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [waOtp, setWaOtp] = useState('');
  const [waStep, setWaStep] = useState(1); // 1: Enter Phone, 2: Enter 6-Digit OTP

  // Realtime listener for WhatsApp verification
  useEffect(() => {
    if (!waRequest?.token) return;

    const channel = supabase.channel(`wa-auth-${waRequest.token}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_auth_requests',
        filter: `token=eq.${waRequest.token}`
      }, async (payload) => {
        if (payload.new?.status === 'verified') {
          const verifiedPhone = payload.new.phone;
          localStorage.setItem('zipit_verified_phone', verifiedPhone);
          if (payload.new.user_id) {
            localStorage.setItem('zipit_active_user_id', payload.new.user_id);
          }
          showToast(`WhatsApp verified! Welcome +91 ${verifiedPhone}`, 'Success');
          onLogin();
        } else if (payload.new?.status && payload.new.status.startsWith('OTP:')) {
          const receivedOtp = payload.new.status.split('OTP:')[1];
          if (receivedOtp) {
            setWaOtp(receivedOtp);
            showToast(`OTP ${receivedOtp} received from WhatsApp! Tapped Auto-fill.`, 'Success');
          }
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [waRequest]);

  const handleStartWhatsAppLogin = async (e) => {
    e?.preventDefault();
    const cleanPhone = phoneInput.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'Error');
      return;
    }

    setLoading(true);
    try {
      const req = await db.whatsapp.createRequest(cleanPhone);
      setWaRequest(req);
      setWaStep(2);

      const storedBotNum = localStorage.getItem('zipit_whatsapp_bot_number') || '919651568829';
      const cleanBotNum = storedBotNum.replace(/\D/g, '');
      const botNumber = cleanBotNum.startsWith('91') ? cleanBotNum : '91' + cleanBotNum.slice(-10);

      const message = encodeURIComponent(`Verify my Zipit account +91 ${cleanPhone} [${req.token}]`);
      const waUrl = `https://wa.me/${botNumber}?text=${message}`;

      window.open(waUrl, '_blank');
      showToast(`Opening WhatsApp chat (+${botNumber})... Send the code to get your OTP!`, 'Info');
    } catch (err) {
      console.error('WhatsApp Login Request Failed:', err);
      showToast(err.message || 'Failed to start WhatsApp login', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyWhatsAppOtp = async (e) => {
    e?.preventDefault();
    const cleanPhone = phoneInput.replace(/\D/g, '').slice(-10);
    const cleanOtp = waOtp.trim();

    if (cleanOtp.length !== 6) {
      showToast('Please enter the 6-digit OTP received in WhatsApp.', 'Error');
      return;
    }

    setLoading(true);
    try {
      const res = await db.whatsapp.verifyOtp(cleanPhone, cleanOtp);
      if (res?.success) {
        localStorage.setItem('zipit_verified_phone', cleanPhone);
        if (res.profile?.id) {
          localStorage.setItem('zipit_active_user_id', res.profile.id);
        }
        if (res.isNewUser) {
          showToast('OTP verified! Please complete your profile details.', 'Success');
        } else {
          showToast(`Welcome back, +91 ${cleanPhone}!`, 'Success');
        }
        onLogin();
      }
    } catch (err) {
      console.error('WhatsApp OTP Verification Error:', err);
      showToast(err.message || 'Invalid OTP. Please check your WhatsApp chat.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Instant simulator for local testing or when user taps "I Sent the Message"
  const handleSimulateWhatsAppVerify = async () => {
    if (!waRequest?.token) return;
    setLoading(true);
    try {
      const mockPhone = phoneInput.replace(/\D/g, '').slice(-10) || '9651568829';
      await db.whatsapp.verifyRequest(waRequest.token, mockPhone);
      showToast('Verification confirmed!', 'Success');
      // The realtime subscription above will handle completion
    } catch (err) {
      showToast(err.message || 'Verification pending. Please send the message on WhatsApp.', 'Warning');
    } finally {
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

        {loginMethod === 'whatsapp' ? (
          <>
            {!waRequest ? (
              <>
                <p className="sub-title">Instant 1-Tap Login with WhatsApp</p>

                <form onSubmit={handleStartWhatsAppLogin} className="login-form">
                  <div className="modern-input-group" style={{ position: 'relative' }}>
                    <div className="email-prefix" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px' }}>🇮🇳</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>+91</span>
                    </div>
                    <input 
                      type="tel" 
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      minLength={10}
                      placeholder="Enter 10-digit mobile number" 
                      value={phoneInput}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        // If user pastes with +91 or leading 0, extract exact last 10 digits if >= 10, else slice to 10
                        if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) {
                          setPhoneInput(digits.slice(-10));
                        } else {
                          setPhoneInput(digits.slice(0, 10));
                        }
                      }}
                      onPaste={e => {
                        e.preventDefault();
                        const pasted = (e.clipboardData || window.clipboardData).getData('text');
                        const digits = pasted.replace(/\D/g, '');
                        setPhoneInput(digits.length > 10 ? digits.slice(-10) : digits.slice(0, 10));
                      }}
                      autoFocus
                      disabled={loading}
                      style={{ fontSize: '15px', fontWeight: '600', letterSpacing: '0.5px' }}
                      required
                    />
                    {phoneInput.length > 0 && (
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        color: phoneInput.length === 10 ? '#22c55e' : '#94a3b8', 
                        paddingRight: '12px',
                        userSelect: 'none'
                      }}>
                        {phoneInput.length}/10
                      </span>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className="whatsapp-login-btn"
                    disabled={phoneInput.length !== 10 || loading}
                    title={phoneInput.length !== 10 ? "Please enter exact 10-digit mobile number" : ""}
                  >
                    <MessageSquare size={19} />
                    <span>{loading ? 'Generating Code...' : 'Continue with WhatsApp'}</span>
                  </button>

                  <div className="login-method-divider">
                    <span>or</span>
                  </div>

                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="method-switch-link"
                      onClick={() => { setLoginMethod('email'); setStep(1); }}
                    >
                      <Mail size={16} /> Continue with Email OTP
                    </button>

                    <button 
                      type="button" 
                      onClick={() => { 
                        const current = localStorage.getItem('zipit_whatsapp_bot_number') || '919651568829';
                        const num = prompt('Enter your dedicated WhatsApp Bot phone number with country code (e.g. 919876543210):', current); 
                        if (num) { 
                          const clean = num.replace(/\D/g, '');
                          localStorage.setItem('zipit_whatsapp_bot_number', clean); 
                          showToast(`Bot WhatsApp Number set to +${clean}`, 'Success'); 
                        } 
                      }} 
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      ⚙️ Target Bot Number (+{localStorage.getItem('zipit_whatsapp_bot_number') || '919651568829'})
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="whatsapp-waiting-card">
                <div className="whatsapp-pulse-bubble">
                  <MessageSquare size={28} color="#25D366" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', margin: '0 0 6px 0' }}>
                    Enter 6-Digit WhatsApp OTP
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                    Send the prefilled code <strong style={{ color: '#25D366', letterSpacing: '1px' }}>{waRequest?.token}</strong> on WhatsApp. Your 6-digit OTP will arrive in the chat!
                  </p>
                </div>

                <form onSubmit={handleVerifyWhatsAppOtp} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                  <div className="modern-input-group">
                    <input 
                      type="text" 
                      placeholder="••••••" 
                      maxLength={6}
                      value={waOtp}
                      onChange={e => setWaOtp(e.target.value.replace(/\D/g, ''))}
                      autoFocus
                      disabled={loading}
                      style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '22px', fontWeight: '800', width: '100%', paddingLeft: '8px' }}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="whatsapp-login-btn"
                    disabled={waOtp.length !== 6 || loading}
                    style={{ padding: '12px', fontSize: '14px', width: '100%', justifyContent: 'center' }}
                  >
                    {loading ? 'Verifying OTP...' : 'Verify OTP & Continue'}
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '6px' }}>
                  <button 
                    type="button" 
                    onClick={handleStartWhatsAppLogin}
                    style={{ background: 'transparent', border: '1px solid rgba(37, 211, 102, 0.4)', color: '#25D366', padding: '8px', borderRadius: '8px', fontSize: '12.5px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Re-open WhatsApp Chat
                  </button>

                  <button 
                    type="button" 
                    onClick={() => { setWaRequest(null); setWaStep(1); setWaOtp(''); setLoginMethod('email'); }}
                    className="method-switch-link"
                    style={{ justifyContent: 'center', fontSize: '12.5px', color: '#cbd5e1' }}
                  >
                    Use Email OTP instead
                  </button>

                  <button 
                    type="button" 
                    onClick={() => { setWaRequest(null); setWaStep(1); setWaOtp(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Use a different number
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* EMAIL OTP METHOD */
          step === 1 ? (
            <>
              <p className="sub-title">Log in or sign up with email OTP</p>

              <form onSubmit={handleSendEmailOtp} className="login-form">
                <div className="modern-input-group">
                  <div className="email-prefix">
                    <Mail size={18} color="#FFF" />
                  </div>
                  <input 
                    type="email" 
                    placeholder="Enter email address" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
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

                <div className="login-method-divider">
                  <span>or</span>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button 
                    type="button" 
                    className="method-switch-link"
                    onClick={() => { setLoginMethod('whatsapp'); setWaRequest(null); }}
                  >
                    <MessageSquare size={16} color="#25D366" /> Back to WhatsApp Login
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <p className="sub-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                OTP sent to {email}
                <button 
                  type="button" 
                  onClick={() => { setStep(1); setOtp(''); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}
                >
                  Change
                </button>
              </p>
              <form onSubmit={handleVerifyEmailOtp} className="login-form">
                <div className="modern-input-group">
                  <input 
                    type="text" 
                    placeholder="Enter 6-digit OTP" 
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    disabled={loading}
                    style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: '800' }}
                  />
                </div>
                
                <button 
                  type="submit" 
                  className="modern-continue-btn" 
                  disabled={otp.length !== 6 || loading}
                >
                  {loading ? 'Verifying...' : 'Verify OTP & Continue'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                  {resendTimer > 0 ? (
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Resend OTP in {resendTimer}s</span>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleSendEmailOtp}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </form>
            </>
          )
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
