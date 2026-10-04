import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate, useParams, useNavigationType } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import Header from './components/Header';
import ProductGrid from './components/ProductGrid';
import CategoriesPage from './components/CategoriesPage';
import PlacedOrdersPage from './components/PlacedOrdersPage';
import ProfilePage from './components/ProfilePage';
import SavedAddressesPage from './components/SavedAddressesPage';
import PaymentMethodsPage from './components/PaymentMethodsPage';
import ProductListPage from './components/ProductListPage';
import AllProductsPage from './components/AllProductsPage';
import PaymentPage from './components/PaymentPage';
import CartBar from './components/CartBar';
import BottomNav from './components/BottomNav';
import HeroSection from './components/HeroSection';
import CheckoutPage from './components/CheckoutPage';
import AddressModal from './components/AddressModal';
import SearchOverlay from './components/SearchOverlay';
import OnboardingModal from './components/OnboardingModal';
import OfflineBanner from './components/OfflineBanner';
import UpdatePrompt from './components/UpdatePrompt';
import SkeletonLoader from './components/SkeletonLoader';
import SplashScreen from './components/SplashScreen';
import WishlistPage from './components/WishlistPage';
import TrackOrderPage from './components/TrackOrderPage';
import SubstituteSelectionPage from './components/SubstituteSelectionPage';
import PastOrdersPage from './components/PastOrdersPage';
import TermsPage from './components/TermsPage';
import ProductDetailsSheet from './components/ProductDetailsSheet';
import PullToRefresh from './components/PullToRefresh';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { WishlistProvider } from './context/WishlistContext';
import { useToast } from './context/ToastContext';
import { playNotificationSound, triggerHapticFeedback } from './utils/audio';
import { db, supabase } from './services/db';
import { getFirebaseMessaging } from './services/firebase';
import { onMessage } from 'firebase/messaging';
import './index.css';
import './App.css';

// ProductListPage Wrapper to extract URL params
const ProductListPageWrapper = (props) => {
  const { categoryId } = useParams();
  const location = useLocation();
  const categoryName = location.state?.categoryName || "Products";
  return <ProductListPage categoryId={categoryId} category={categoryName} {...props} />;
};

const PaymentPageWrapper = (props) => {
  // We can pass address from context or default
  return <PaymentPage address={props.defaultAddress} {...props} />;
};

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const viewName = location.pathname;

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cart, setCart] = useState([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState(16);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Scroll to top on route change
  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 10);
  }, [location.pathname]);

  // Global Cart Fly Animation
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      const text = target.textContent?.trim();
      if (text === 'ADD' || text === '+') {
        const card = target.closest('.bestseller-card') || target.closest('.product-card') || target.closest('.category-product-card') || target.closest('.hero-product-card') || target.closest('.search-product-item');
        if (!card) return;
        const img = card.querySelector('img');
        if (!img) return;

        const imgRect = img.getBoundingClientRect();
        
        let targetX = window.innerWidth / 2;
        let targetY = window.innerHeight - 80; 
        
        // Let React mount CartBar first
        setTimeout(() => {
          const cartPill = document.querySelector('.cart-bar-pill-left');
          const cartContainer = document.querySelector('.cart-bar-container');
          
          if (cartPill && cartContainer) {
            const pillRect = cartPill.getBoundingClientRect();
            // X is always accurate even during slide-up animation
            targetX = pillRect.left + 20; 
            // Y is mathematically predicted because pillRect.top might be mid-animation (100px lower)
            const isNavHidden = cartContainer.classList.contains('nav-hidden');
            targetY = window.innerHeight - (isNavHidden ? 42 : 106);
          }

          const flyer = document.createElement('img');
          flyer.src = img.src;
          flyer.style.position = 'fixed';
          flyer.style.left = `${imgRect.left}px`;
          flyer.style.top = `${imgRect.top}px`;
          flyer.style.width = `${imgRect.width}px`;
          flyer.style.height = `${imgRect.height}px`;
          flyer.style.borderRadius = '12px';
          flyer.style.objectFit = 'cover';
          flyer.style.zIndex = '999999';
          flyer.style.pointerEvents = 'none';
          flyer.style.transition = 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
          document.body.appendChild(flyer);

          flyer.getBoundingClientRect(); 

          flyer.style.left = `${targetX}px`;
          flyer.style.top = `${targetY}px`;
          flyer.style.width = '24px';
          flyer.style.height = '24px';
          flyer.style.opacity = '0.5';
          flyer.style.borderRadius = '50%';
          flyer.style.transform = 'scale(0.5)';

          if (cartPill) {
            const pillContainer = document.querySelector('.cart-bar-pill');
            if (pillContainer) {
              pillContainer.style.transition = 'transform 0.2s';
              setTimeout(() => {
                pillContainer.style.transform = 'scale(1.05)';
                setTimeout(() => {
                  pillContainer.style.transform = 'scale(1)';
                }, 150);
              }, 400); 
            }
          }

          setTimeout(() => {
            if (document.body.contains(flyer)) {
              document.body.removeChild(flyer);
            }
          }, 600);
        }, 10);
      }
    };
    document.addEventListener('click', handleGlobalClick, true); // Use capture phase to bypass stopPropagation
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, []);

  const openSearch = (isVoice = false) => {
    if (!isSearchOpen) {
      window.history.pushState({ searchOpen: true }, '');
    }
    setIsSearchOpen(true);
    setIsVoiceSearchOpen(isVoice);
  };

  const closeSearch = () => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      if (window.history.state?.searchOpen) {
        window.history.back();
      }
    }
  };

  const openProductSheet = (product) => {
    if (!selectedProduct) {
      window.history.pushState({ productOpen: true }, '');
    }
    setSelectedProduct(product);
  };

  const closeProductSheet = () => {
    if (selectedProduct) {
      setSelectedProduct(null);
      if (window.history.state?.productOpen) {
        window.history.back();
      }
    }
  };

  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state || {};
      
      if (state.productOpen) {
        // Product sheet state
        setIsSearchOpen(false); // Optional, but usually true if they arrived some other way
      } else if (state.searchOpen) {
        // Back to search overlay
        setSelectedProduct(null);
        setIsSearchOpen(true);
      } else {
        // Base state
        setSelectedProduct(null);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSearchOpen, selectedProduct]);
  const [headerBgColor, setHeaderBgColor] = useState('linear-gradient(to right, #F8CB46, #F9D423)');

  const [userProfile, setUserProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [gpsLocation, setGpsLocation] = useState(() => {
    return localStorage.getItem('zipit_gps_area') || 'Sector 14, MG Road, Gurugram';
  });

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`);
            const data = await res.json();
            if (data && data.address) {
              const area = data.address.suburb || data.address.neighbourhood || data.address.road || data.address.city_district || 'Sector 14, MG Road';
              const city = data.address.city || data.address.state_district || 'Gurugram';
              const combinedGps = `${area}, ${city}`;
              setGpsLocation(combinedGps);
              localStorage.setItem('zipit_gps_area', combinedGps);
            }
          } catch (e) {
            console.log('GPS reverse geocode fallback');
          }
        },
        (err) => {
          console.log('GPS default location retained');
        },
        { timeout: 6000, maximumAge: 300000 }
      );
    }
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = React.useRef(0);
  
  const { showToast } = useToast();
  const { theme } = useTheme();
  
  const knownOrderStatuses = React.useRef({});

  useEffect(() => {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    
    if (viewName === '/' || viewName === '/categories') {
      metaThemeColor.content = theme === 'dark' ? '#1E1E1E' : '#F8CB46';
    } else if (viewName === '/profile') {
      metaThemeColor.content = theme === 'dark' ? '#4F2F1D' : '#FFEAA7';
    } else {
      metaThemeColor.content = theme === 'dark' ? '#121212' : '#F3F4F6';
    }
  }, [viewName, theme]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!userProfile?.id) return;
    
    const userChannel = supabase.channel('user-orders-listener')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `profile_id=eq.${userProfile.id}` }, (payload) => {
        const newStatus = payload.new.status;
        const previousStatus = knownOrderStatuses.current[payload.new.id];
        
        if (newStatus && previousStatus && newStatus !== previousStatus) {
          playNotificationSound();
          showToast(`Your order status changed to: ${newStatus}`, 'Order Update');
        }
        
        if (newStatus) {
          knownOrderStatuses.current[payload.new.id] = newStatus;
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [userProfile]);

  useEffect(() => {
    const messaging = getFirebaseMessaging();
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);
        playNotificationSound();
        showToast(payload.notification?.title || 'Notification', payload.notification?.body || 'New message received', 'success');
      });
      return () => unsubscribe();
    }
  }, [showToast]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 150);
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsNavHidden(true);
      } else if (currentScrollY < lastScrollY.current) {
        setIsNavHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setIsInitializingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    
    const initDB = async (silent = false) => {
      if (!silent) setIsLoading(true);
      const profile = await db.user.get();
      setUserProfile(profile);
      const addrs = await db.addresses.getAll();
      setAddresses(addrs);
      
      const orders = await db.orders.getAll();
      orders.forEach(o => {
        knownOrderStatuses.current[o.id] = o.status;
      });
      
      const savedCart = await db.carts.get();
      if (savedCart && savedCart.length > 0) {
        setCart(savedCart);
      } else {
        setCart([]);
      }
      localStorage.removeItem('cart'); // Clear any legacy local storage cart
      
      if (!silent) setIsLoading(false);

      if (!silent) {
        setTimeout(async () => {
          try {
            const allProducts = await db.products.getAll();
            const allCategories = await db.categories.getAll();
            
            const urls = [
              ...allCategories.map(c => c.image_url),
              ...allProducts.slice(0, 15).map(p => p.image_url)
            ].filter(Boolean);
            
            const uniqueUrls = [...new Set(urls)];
            
            // Preload via Image object to ensure browser cache gets them
            uniqueUrls.forEach(url => {
              const img = new Image();
              img.src = url;
            });
            
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'PRECACHE_IMAGES',
                urls: uniqueUrls
              });
            }
          } catch (err) {
            console.error('Preload error:', err);
          }
        }, 1000);
      }
    };
    
    initDB();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initDB(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    const dataChannel = supabase.channel('global-data-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => initDB(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => initDB(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => initDB(true))
      .subscribe();
      
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(dataChannel);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    setDeliveryTime(Math.floor(Math.random() * 11) + 8);
  }, []);

  const updateCartQty = (product, delta) => {
    if (delta > 0) {
      // Stock limit check
      if (product.is_out_of_stock || product.stock_count === 0) {
        showToast(`The ${product.name} is Out of Stock currently.`, 'warning');
        triggerHapticFeedback([30, 20]);
        return;
      }
      const stockLimit = product.stock_count;
      const hasLimit = stockLimit !== undefined && stockLimit !== null && stockLimit > 0;
      if (hasLimit) {
        const currentQtyInCart = cart.find(i => i.id === product.id)?.qty || 0;
        if (currentQtyInCart + delta > stockLimit) {
          showToast(`Only ${stockLimit} unit${stockLimit !== 1 ? 's' : ''} available for "${product.name}"`, 'warning');
          triggerHapticFeedback([30, 20]);
          return;
        }
      }
      triggerHapticFeedback([15]);
    } else {
      triggerHapticFeedback([10]);
    }

    setCart(prev => {
      let newCart = prev;
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty + delta <= 0) newCart = prev.filter(item => item.id !== product.id);
        else newCart = prev.map(item => item.id === product.id ? { ...item, qty: item.qty + delta } : item);
      } else {
        if (delta > 0) newCart = [...prev, { ...product, qty: 1 }];
      }
      
      if (userProfile?.id) {
        db.carts.sync(newCart);
      }
      return newCart;
    });
  };

  const handleSetDefaultAddress = async (id) => {
    if (id === 'GPS') {
      const gpsArea = localStorage.getItem('zipit_gps_area') || 'Sector 14, MG Road, Gurugram';
      const tempGpsAddr = {
        id: 'GPS_CURRENT',
        type: 'Current Location',
        details: gpsArea,
        is_default: true,
        phone: userProfile?.phone || ''
      };
      setAddresses(prev => [tempGpsAddr, ...prev.map(a => ({ ...a, is_default: false }))]);
      showToast('Switched to GPS Location', gpsArea);
      return;
    }
    await db.addresses.setDefault(id);
    const addrs = await db.addresses.getAll();
    setAddresses(addrs);
  };

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const itemTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const smallCartCharge = itemTotal > 0 ? 9 : 0;
  const deliveryCharge = (itemTotal > 0 && itemTotal < 149) ? 20 : 0;
  
  const discountAmount = appliedCoupon 
    ? (appliedCoupon.discount_type === 'PERCENTAGE' 
        ? (itemTotal * appliedCoupon.discount_value / 100) 
        : appliedCoupon.discount_type === 'FREE_DELIVERY' 
            ? deliveryCharge 
            : appliedCoupon.discount_value)
    : 0;
    
  const grandTotal = itemTotal > 0 ? Math.max(0, itemTotal + smallCartCharge + deliveryCharge - discountAmount) : 0;

  // Clear coupon if item total falls below minimum order amount
  useEffect(() => {
    if (appliedCoupon && itemTotal < appliedCoupon.min_order_amount) {
      setAppliedCoupon(null);
    }
  }, [itemTotal, appliedCoupon]);

  if (showSplash || isInitializingAuth) {
    return <SplashScreen />;
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  if (isLoading) {
    return <SplashScreen />;
  }

  const showBottomNav = ['/', '/categories', '/track'].includes(viewName);
  const activeTab = viewName === '/' ? 'home' : viewName === '/categories' ? 'categories' : viewName === '/track' ? 'track' : '';
  const showCartBar = totalItems > 0 && !viewName.includes('/checkout') && !viewName.includes('/payment') && !selectedProduct;

  // Whenever user navigates to /checkout or /payment, ensure all modal/overlay states and body locks are cleaned up
  useEffect(() => {
    if (viewName === '/checkout' || viewName === '/payment') {
      setIsSearchOpen(false);
      setSelectedProduct(null);
      setIsAddressModalOpen(false);
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  }, [viewName]);

  const handleOpenCart = () => {
    setIsSearchOpen(false);
    setSelectedProduct(null);
    setIsAddressModalOpen(false);
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    navigate('/checkout');
  };

  const handleRefreshApp = async () => {
    try {
      await db.products.getAll();
      if (userProfile?.phone) {
        const userAddrs = await db.addresses.getByPhone(userProfile.phone);
        setAddresses(userAddrs || []);
      }
      showToast('Inventory & prices updated');
    } catch (e) {
      console.error('Refresh error', e);
    }
  };

  return (
    <>
      <PullToRefresh onRefresh={handleRefreshApp}>
        <div key={location.pathname} className="page-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {(viewName === '/' || viewName === '/categories') && (
            <Header 
              time={deliveryTime} 
              onAddressClick={() => setIsAddressModalOpen(true)}
              onSearchClick={(isVoice) => openSearch(isVoice === true)}
              onProfileClick={() => navigate('/profile')}
              defaultAddress={defaultAddress}
              gpsLocation={gpsLocation}
              isHome={viewName === '/'}
              isNavHidden={isNavHidden}
              bgColor="var(--color-header-bg)"
              cart={cart}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
            />
          )}
          {viewName === '/' && (
            <HeroSection onImageChange={setHeaderBgColor} cart={cart} updateCartQty={updateCartQty} navigate={navigate} />
          )}
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
            <Routes>
              <Route path="/" element={<ProductGrid cart={cart} updateCartQty={updateCartQty} navigate={navigate} onProductClick={openProductSheet} />} />
              <Route path="/categories" element={<CategoriesPage navigate={navigate} />} />
              <Route path="/orders" element={<PlacedOrdersPage navigate={navigate} />} />
              <Route path="/profile" element={<ProfilePage navigate={navigate} userProfile={userProfile} setUserProfile={setUserProfile} onLogout={() => { setIsLoggedIn(false); setCart([]); setUserProfile(null); }} />} />
              <Route path="/saved-addresses" element={<SavedAddressesPage navigate={navigate} addresses={addresses} setAddresses={setAddresses} from={location.state?.from} add={location.state?.add} />} />
              <Route path="/payment-methods" element={<PaymentMethodsPage navigate={navigate} />} />
              <Route path="/terms" element={<TermsPage navigate={navigate} />} />
              <Route path="/category/:categoryId" element={<ProductListPageWrapper navigate={navigate} cart={cart} updateCartQty={updateCartQty} onSearchClick={() => openSearch(false)} onProductClick={openProductSheet} />} />
              <Route path="/all-products" element={<AllProductsPage navigate={navigate} cart={cart} updateCartQty={updateCartQty} onSearchClick={() => openSearch(false)} onProductClick={openProductSheet} />} />
              <Route path="/wishlist" element={<WishlistPage navigate={navigate} cart={cart} updateCartQty={updateCartQty} />} />
              <Route path="/track" element={<TrackOrderPage navigate={navigate} />} />
              <Route path="/substitute-selection" element={<SubstituteSelectionPage navigate={navigate} />} />
              <Route path="/past-orders" element={<PastOrdersPage navigate={navigate} updateCartQty={updateCartQty} />} />
              <Route path="/checkout" element={<CheckoutPage navigate={navigate} cart={cart} updateCartQty={updateCartQty} itemTotal={itemTotal} smallCartCharge={smallCartCharge} deliveryCharge={deliveryCharge} grandTotal={grandTotal} address={defaultAddress} onAddressClick={() => setIsAddressModalOpen(true)} appliedCoupon={appliedCoupon} setAppliedCoupon={setAppliedCoupon} discountAmount={discountAmount} clearCart={() => setCart([])} />} />
              <Route path="/payment" element={<PaymentPageWrapper defaultAddress={defaultAddress} navigate={navigate} cart={cart} total={grandTotal} deliveryCharge={deliveryCharge} smallCartCharge={smallCartCharge} clearCart={() => setCart([])} appliedCoupon={appliedCoupon} setAppliedCoupon={setAppliedCoupon} discountAmount={discountAmount} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </PullToRefresh>
      
      {showCartBar && (
        <CartBar 
          count={totalItems} 
          total={itemTotal} 
          cart={cart} 
          onOpen={handleOpenCart} 
          isNavHidden={(!showBottomNav || isNavHidden) && !selectedProduct} 
        />
      )}
      
      {showBottomNav && (
        <BottomNav
          activeTab={activeTab}
          navigate={navigate}
          openCart={handleOpenCart}
          isNavHidden={isNavHidden}
        />
      )}
      
      <AddressModal 
        isOpen={isAddressModalOpen} 
        onClose={() => setIsAddressModalOpen(false)} 
        addresses={addresses}
        navigate={navigate}
        onSelectAddress={handleSetDefaultAddress}
        currentRoute={viewName}
      />
      <SearchOverlay 
        isOpen={isSearchOpen} 
        onClose={closeSearch} 
        cart={cart}
        updateCartQty={updateCartQty}
        initialVoiceSearch={isVoiceSearchOpen}
        onProductClick={openProductSheet}
      />
      
      {selectedProduct && (
        <ProductDetailsSheet 
          product={selectedProduct} 
          cart={cart}
          updateCartQty={updateCartQty}
          onClose={closeProductSheet} 
        />
      )}
      
      {userProfile?.name === 'New User' && (
        <OnboardingModal 
          userProfile={userProfile} 
          onComplete={(newData) => {
            setUserProfile(prev => ({ ...prev, ...newData }));
          }} 
        />
      )}
      
      <OfflineBanner />
      <UpdatePrompt />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WishlistProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </WishlistProvider>
    </ThemeProvider>
  );
}

export default App;
