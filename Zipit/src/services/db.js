import { createClient } from '@supabase/supabase-js';
import { preloadImages } from '../utils/imageCache';

const supabaseUrl = 'https://bbaggauqnlcohrgvsios.supabase.co';
const supabaseAnonKey = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session.user.id;
  const storedId = localStorage.getItem('zipit_active_user_id');
  return storedId || null;
};

export const db = {
  user: {
    get: async () => {
      const pid = await getUserId();
      if (!pid) return null;
      
      const cached = localStorage.getItem('zipit_cached_user_profile');
      let cachedProfile = null;
      if (cached) {
        try { cachedProfile = JSON.parse(cached); } catch (_) {}
      }

      const { data, error } = await supabase.from('profiles').select('*').eq('id', pid).single();
      
      if (!data) {
        if (cachedProfile) return cachedProfile;
        const { data: authData } = await supabase.auth.getUser();
        const userEmail = authData?.user?.email || '';
        // High entropy unique string prevents profiles_phone_key duplicate error
        const randomPhone = 'temp_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
        const { data: newData, error: insertError } = await supabase.from('profiles').insert([{ 
          id: pid,
          name: 'New User', 
          phone: randomPhone, 
          email: userEmail,
          photo: 'NU' 
        }]).select().single();
        if (insertError) console.error("DB Error (profiles insert):", insertError);
        if (newData) {
          try { localStorage.setItem('zipit_cached_user_profile', JSON.stringify(newData)); } catch (_) {}
        }
        return newData;
      }
      if (data) {
        if (data.photo && data.photo.includes('|||')) {
          const parts = data.photo.split('|||');
          data.photo = parts[0];
          data.fcm_token = parts[1];
        } else {
          data.fcm_token = null;
        }
        try { localStorage.setItem('zipit_cached_user_profile', JSON.stringify(data)); } catch (_) {}
      }
      return data;
    },
    update: async (formData) => {
      const pid = await getUserId();
      if (!pid) return { error: 'No user session found' };
      
      const { id, created_at, addresses_list, ...updateData } = formData;
      
      // Clean phone number
      if (updateData.phone === '') {
        updateData.phone = null;
      }
      
      if (updateData.email === '') {
        delete updateData.email;
      }

      // Check for duplicates in phone or email across other profiles
      if (updateData.phone) {
        const { data: existingPhone } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('phone', updateData.phone)
          .neq('id', pid)
          .limit(1);

        if (existingPhone && existingPhone.length > 0) {
          const warning = "This phone number is already registered with another account. Please use a different phone number.";
          alert(warning);
          return { error: warning };
        }
      }

      if (updateData.email) {
        const { data: existingEmail } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('email', updateData.email)
          .neq('id', pid)
          .limit(1);

        if (existingEmail && existingEmail.length > 0) {
          const warning = "This email address is already registered with another account. Please use a different email address.";
          alert(warning);
          return { error: warning };
        }
      }
      
      const current = await db.user.get();
      
      let basePhoto = updateData.photo !== undefined ? updateData.photo : (current?.photo || 'NU');
      if (basePhoto && basePhoto.includes('|||')) {
        basePhoto = basePhoto.split('|||')[0];
      }
      
      let token = updateData.fcm_token !== undefined ? updateData.fcm_token : current?.fcm_token;
      
      if (token) {
        updateData.photo = `${basePhoto}|||${token}`;
      } else {
        updateData.photo = basePhoto;
      }
      
      delete updateData.fcm_token;

      const { data, error } = await supabase.from('profiles').update(updateData).eq('id', pid).select().single();
      if (error) {
        console.error("DB Error (profiles update):", error);
        if (error.message.includes('profiles_phone_key') || error.code === '23505') {
          const warning = "This phone number is already registered with another account. Please use a different phone number.";
          alert(warning);
          return { error: warning };
        } else {
          alert("Could not update profile: " + error.message);
          return { error: error.message };
        }
      }
      
      if (data) {
        if (data.photo && data.photo.includes('|||')) {
          const parts = data.photo.split('|||');
          data.photo = parts[0];
          data.fcm_token = parts[1];
        } else {
          data.fcm_token = null;
        }
        try { localStorage.setItem('zipit_cached_user_profile', JSON.stringify(data)); } catch (_) {}
      }
      
      return { data };
    }
  },
  addresses: {
    getAll: async () => {
      const pid = await getUserId();
      if (!pid) return [];
      
      const extractAddressInfo = (rawDetails, baseObj = {}) => {
        let text = (rawDetails || '').toString();
        let phone = baseObj.phone || '';
        let lat = baseObj.lat || '28.4595';
        let lng = baseObj.lng || '77.0266';
        let gps_area = baseObj.gps_area || localStorage.getItem('zipit_gps_area') || 'Sector 14, MG Road, Gurugram';
        let google_maps_url = baseObj.google_maps_url || '';
        let landmark = '';
        let family_head = '';
        let alt_phone = '';
        let village_area = '';

        if (text.includes('---TAG:PHONE:')) {
          phone = text.split('---TAG:PHONE:')[1]?.split('---')[0] || phone;
        }
        if (text.includes('---TAG:LANDMARK:')) {
          landmark = text.split('---TAG:LANDMARK:')[1]?.split('---')[0] || '';
        }
        if (text.includes('---TAG:FAMILY_HEAD:')) {
          family_head = text.split('---TAG:FAMILY_HEAD:')[1]?.split('---')[0] || '';
        }
        if (text.includes('---TAG:ALT_PHONE:')) {
          alt_phone = text.split('---TAG:ALT_PHONE:')[1]?.split('---')[0] || '';
        }
        if (text.includes('---TAG:VILLAGE:')) {
          village_area = text.split('---TAG:VILLAGE:')[1]?.split('---')[0] || '';
        }
        if (text.includes('---TAG:LAT:')) {
          lat = text.split('---TAG:LAT:')[1]?.split('---')[0] || lat;
        }
        if (text.includes('---TAG:LNG:')) {
          lng = text.split('---TAG:LNG:')[1]?.split('---')[0] || lng;
        }
        if (text.includes('---TAG:GPS_AREA:')) {
          gps_area = text.split('---TAG:GPS_AREA:')[1]?.split('---')[0] || gps_area;
        }
        if (text.includes('---TAG:GMAPS:')) {
          google_maps_url = text.split('---TAG:GMAPS:')[1]?.split('---')[0] || google_maps_url;
        }

        // Clean out ALL tags from visible text
        let cleanText = text.replace(/[\s\n]*---[A-Z_]+:[^-\n]*---/g, '').trim();
        if (cleanText.includes('---')) {
          cleanText = cleanText.split('---')[0].trim();
        }

        return {
          details: cleanText,
          phone,
          landmark,
          family_head,
          alt_phone,
          village_area,
          lat,
          lng,
          gps_area,
          google_maps_url: google_maps_url || `https://maps.google.com/?q=${lat},${lng}`
        };
      };

      // Parallelize profile and secondary addresses queries
      const [profileRes, addrsRes] = await Promise.all([
        supabase.from('profiles').select('address, phone, lat, lng, gps_area, google_maps_url').eq('id', pid).maybeSingle(),
        supabase.from('addresses').select('*').eq('profile_id', pid).neq('type', 'WISHLIST')
      ]);

      const profile = profileRes.data;
      const allAddresses = [];
      
      if (profile && profile.address) {
        const parsedPrimary = extractAddressInfo(profile.address, {
          phone: profile.phone || '',
          lat: profile.lat?.toString() || '28.4595',
          lng: profile.lng?.toString() || '77.0266',
          gps_area: profile.gps_area,
          google_maps_url: profile.google_maps_url
        });

        allAddresses.push({
          id: 'primary',
          profile_id: pid,
          type: 'HOME',
          is_default: true,
          ...parsedPrimary
        });
      }

      const secondaryAddrs = (addrsRes.data || []).map(addr => {
        const parsed = extractAddressInfo(addr.details, {
          lat: '28.4595',
          lng: '77.0266'
        });

        return {
          ...addr,
          ...parsed,
          is_default: false
        };
      });
      
      const combined = [...allAddresses, ...secondaryAddrs];
      if (combined.length > 0) {
        try { localStorage.setItem('zipit_cached_addresses', JSON.stringify(combined)); } catch (_) {}
      }
      return combined;
    },
    add: async (addr) => {
      const pid = await getUserId();
      if (!pid) return null;
      
      const profile = await db.user.get();
      const userName = profile?.name || 'Unknown';
      
      const payload = { ...addr };
      const { phone, lat, lng, gps_area, google_maps_url, landmark, family_head, alt_phone, village_area } = payload;
      let cleanDetails = (payload.details || '').replace(/[\s\n]*---[A-Z_]+:[^-\n]*---/g, '').trim();
      if (cleanDetails.includes('---')) cleanDetails = cleanDetails.split('---')[0].trim();

      const tags = [
        phone ? `---TAG:PHONE:${phone}---` : '',
        landmark ? `---TAG:LANDMARK:${landmark}---` : '',
        family_head ? `---TAG:FAMILY_HEAD:${family_head}---` : '',
        alt_phone ? `---TAG:ALT_PHONE:${alt_phone}---` : '',
        village_area ? `---TAG:VILLAGE:${village_area}---` : '',
        lat ? `---TAG:LAT:${lat}---` : '',
        lng ? `---TAG:LNG:${lng}---` : '',
        gps_area ? `---TAG:GPS_AREA:${gps_area}---` : '',
        google_maps_url ? `---TAG:GMAPS:${google_maps_url}---` : '',
        `---TAG:NAME:${userName}---`
      ].filter(Boolean).join('\n');

      if (!profile || !profile.address) {
        // First address, make it primary!
        const { data, error } = await supabase.from('profiles').update({
          address: cleanDetails ? `${cleanDetails}\n${tags}` : tags,
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          gps_area: gps_area || null,
          google_maps_url: google_maps_url || null,
          phone: phone || profile?.phone
        }).eq('id', pid).select().single();
        if (error) throw new Error(error.message);
        return { id: 'primary', ...data, landmark, family_head, alt_phone, village_area };
      }

      payload.details = `${cleanDetails}\n${tags}`;
      delete payload.phone; delete payload.lat; delete payload.lng; delete payload.gps_area; delete payload.map_full_address; delete payload.google_maps_url;
      delete payload.landmark; delete payload.family_head; delete payload.alt_phone; delete payload.village_area;
      
      const { data, error } = await supabase.from('addresses').insert([{ ...payload, profile_id: pid, is_default: false }]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    update: async (id, addr) => {
      const pid = await getUserId();
      if (!pid) return null;

      const profile = await db.user.get();
      const userName = profile?.name || 'Unknown';
      
      const payload = { ...addr };
      const { phone, lat, lng, gps_area, google_maps_url, landmark, family_head, alt_phone, village_area } = payload;
      let cleanDetails = (payload.details || '').replace(/[\s\n]*---[A-Z_]+:[^-\n]*---/g, '').trim();
      if (cleanDetails.includes('---')) cleanDetails = cleanDetails.split('---')[0].trim();

      const tags = [
        phone ? `---TAG:PHONE:${phone}---` : '',
        landmark ? `---TAG:LANDMARK:${landmark}---` : '',
        family_head ? `---TAG:FAMILY_HEAD:${family_head}---` : '',
        alt_phone ? `---TAG:ALT_PHONE:${alt_phone}---` : '',
        village_area ? `---TAG:VILLAGE:${village_area}---` : '',
        lat ? `---TAG:LAT:${lat}---` : '',
        lng ? `---TAG:LNG:${lng}---` : '',
        gps_area ? `---TAG:GPS_AREA:${gps_area}---` : '',
        google_maps_url ? `---TAG:GMAPS:${google_maps_url}---` : '',
        `---TAG:NAME:${userName}---`
      ].filter(Boolean).join('\n');

      if (id === 'primary') {
        const { data, error } = await supabase.from('profiles').update({
          address: cleanDetails ? `${cleanDetails}\n${tags}` : tags,
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          gps_area: gps_area || null,
          google_maps_url: google_maps_url || null,
          phone: phone || profile?.phone
        }).eq('id', pid).select().single();
        if (error) throw new Error(error.message);
        return { id: 'primary', ...data, landmark, family_head, alt_phone, village_area };
      }

      payload.details = `${cleanDetails}\n${tags}`;
      delete payload.phone; delete payload.lat; delete payload.lng; delete payload.gps_area; delete payload.map_full_address; delete payload.google_maps_url;
      delete payload.landmark; delete payload.family_head; delete payload.alt_phone; delete payload.village_area;

      const { data, error } = await supabase.from('addresses').update(payload).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    delete: async (id) => {
      const pid = await getUserId();
      if (!pid) return;

      if (id === 'primary') {
        // Clear primary
        await supabase.from('profiles').update({
          address: null, lat: null, lng: null, gps_area: null, google_maps_url: null
        }).eq('id', pid);
        
        // Promote next address to primary if exists
        const { data } = await supabase.from('addresses').select('*').eq('profile_id', pid).neq('type', 'WISHLIST').limit(1);
        if (data && data.length > 0) {
           const nextAddr = data[0];
           await db.addresses.setDefault(nextAddr.id);
        }
      } else {
        const { error } = await supabase.from('addresses').delete().eq('id', id);
        if (error) console.error("DB Error (addresses delete):", error);
      }
    },
    setDefault: async (id) => {
      const pid = await getUserId();
      if (!pid || id === 'primary') return;
      
      const profile = await db.user.get();
      const allAddrs = await db.addresses.getAll();
      const targetAddr = allAddrs.find(a => a.id === id);
      const currentPrimary = allAddrs.find(a => a.id === 'primary');
      
      if (!targetAddr) return;

      // 1. Move old primary to addresses table (if it exists)
      if (currentPrimary && currentPrimary.details) {
         const oldTags = [
           currentPrimary.phone ? `---TAG:PHONE:${currentPrimary.phone}---` : '',
           currentPrimary.lat ? `---TAG:LAT:${currentPrimary.lat}---` : '',
           currentPrimary.lng ? `---TAG:LNG:${currentPrimary.lng}---` : '',
           currentPrimary.gps_area ? `---TAG:GPS_AREA:${currentPrimary.gps_area}---` : '',
           currentPrimary.google_maps_url ? `---TAG:GMAPS:${currentPrimary.google_maps_url}---` : '',
           `---TAG:NAME:${profile?.name || 'Unknown'}---`
         ].filter(Boolean).join('\n');
         
         await supabase.from('addresses').insert([{ 
           profile_id: pid, 
           type: 'HOME', 
           is_default: false, 
           details: `${currentPrimary.details}\n${oldTags}`
         }]);
      }
      
      // 2. Set target address to profiles table
      await supabase.from('profiles').update({
          address: targetAddr.details,
          lat: targetAddr.lat ? parseFloat(targetAddr.lat) : null,
          lng: targetAddr.lng ? parseFloat(targetAddr.lng) : null,
          gps_area: targetAddr.gps_area || null,
          google_maps_url: targetAddr.google_maps_url || null,
          phone: targetAddr.phone || profile?.phone
      }).eq('id', pid);

      // 3. Delete target address from addresses table
      await supabase.from('addresses').delete().eq('id', id);
    }
  },
  wishlist: {
    get: async () => {
      const pid = await getUserId();
      if (!pid) return [];
      const { data, error } = await supabase.from('addresses').select('*').eq('profile_id', pid).eq('type', 'WISHLIST').single();
      if (!data) return [];
      try {
        return JSON.parse(data.details || '[]');
      } catch (e) {
        return [];
      }
    },
    save: async (productIds) => {
      const pid = await getUserId();
      if (!pid) return;
      
      const { data: existing } = await supabase.from('addresses').select('*').eq('profile_id', pid).eq('type', 'WISHLIST').single();
      const details = JSON.stringify(productIds);
      
      if (existing) {
        await supabase.from('addresses').update({ details }).eq('id', existing.id);
      } else {
        await supabase.from('addresses').insert([{ 
          profile_id: pid, 
          type: 'WISHLIST', 
          details: details
        }]);
      }
    }
  },
  orders: {
    getAll: async () => {
      const pid = await getUserId();
      if (!pid) return [];
      const { data, error } = await supabase.from('orders').select('*').eq('profile_id', pid).order('created_at', { ascending: false });
      if (error) console.error("DB Error (orders get):", error);
      return data || [];
    },
    getById: async (id) => {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
      return error ? null : data;
    },
    add: async (orderData) => {
      const pid = await getUserId();
      if (!pid) return null;
      
      // Generate a 4-digit delivery handover OTP for non-pickup orders
      const isPickup = orderData.address?.is_pickup === true || orderData.address?.order_type === 'PICKUP';
      const deliveryOtp = isPickup ? null : String(Math.floor(1000 + Math.random() * 9000));

      const { data, error } = await supabase.from('orders').insert([{
        profile_id: pid,
        items: orderData.items,
        total: orderData.total,
        delivery_address: orderData.address,
        payment_method: orderData.paymentMethod,
        status: orderData.paymentMethod === 'UPI' ? 'Payment Pending' : 'Placed',
        delivery_charge: orderData.deliveryCharge,
        small_cart_charge: orderData.smallCartCharge,
        applied_coupon: orderData.appliedCoupon || null,
        discount_amount: orderData.discountAmount || 0,
        delivery_otp: deliveryOtp
      }]).select().single();

      if (error) {
        console.error("DB Error (orders add):", error);
        throw error;
      }

      // Deduct inventory stock for purchased items atomically via RPC or fallback
      if (Array.isArray(orderData.items) && orderData.items.length > 0) {
        for (const item of orderData.items) {
          const qty = Number(item.quantity || item.qty || 1);
          const itemId = item.id;
          if (itemId && qty > 0) {
            try {
              // Try atomic RPC function first
              const { error: rpcErr } = await supabase.rpc('decrement_product_stock', {
                p_product_id: itemId,
                p_quantity: qty
              });

              if (rpcErr) {
                // Client fallback if RPC not installed yet in Supabase
                const { data: prod } = await supabase.from('products').select('stock_count').eq('id', itemId).single();
                if (prod && typeof prod.stock_count === 'number' && prod.stock_count > 0) {
                  const nextStock = Math.max(0, prod.stock_count - qty);
                  await supabase.from('products').update({ 
                    stock_count: nextStock,
                    is_out_of_stock: nextStock === 0 
                  }).eq('id', itemId);
                }
              }
            } catch (stockErr) {
              console.warn("Stock decrement skipped for item:", itemId, stockErr);
            }
          }
        }
      }

      return data;
    },
    updateStatus: async (id, status) => {
      const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
      if (error) console.error("DB Error (orders updateStatus):", error);
      return data;
    },
    getAllAdmin: async () => {
      // Fetch all orders with user profiles
      const { data, error } = await supabase.from('orders').select('*, profiles(name, phone)').order('created_at', { ascending: false });
      if (error) console.error("DB Error (orders getAllAdmin):", error);
      return data || [];
    },
    delete: async (id) => {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) console.error("DB Error (orders delete):", error);
    }
  },
  paymentMethods: {
    getAll: async () => {
      return [
        { id: 1, method: 'UPI', details: 'sujal@upi' }
      ];
    }
  },
  categories: {
    getAll: async () => {
      try {
        const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          try { 
            localStorage.setItem('zipit_cached_categories', JSON.stringify(data));
            preloadImages(data.map(c => c.image_url));
          } catch (e) {}
        }
        return data || [];
      } catch (err) {
        console.warn("DB offline fallback (categories):", err);
        const cached = localStorage.getItem('zipit_cached_categories');
        return cached ? JSON.parse(cached) : [];
      }
    },
    add: async (category) => {
      const { data, error } = await supabase.from('categories').insert([category]).select().single();
      if (error) console.error("DB Error (categories add):", error);
      return data;
    },
    update: async (id, category) => {
      const { data, error } = await supabase.from('categories').update(category).eq('id', id).select().single();
      if (error) console.error("DB Error (categories update):", error);
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) console.error("DB Error (categories delete):", error);
    },
    uploadImage: async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('category-images')
        .upload(filePath, file);
        
      if (uploadError) {
        console.error('Upload Error:', uploadError);
        return null;
      }
      
      const { data } = supabase.storage.from('category-images').getPublicUrl(filePath);
      return data.publicUrl;
    }
  },
  products: {
    getAll: async () => {
      try {
        const { data, error } = await supabase.from('products').select('*, categories(name)').order('created_at', { ascending: false });
        if (error) throw error;
        
        const filtered = (data || []).filter(p => !p.name.includes('---TAG:BANNER---'));
        const mapped = filtered.map(p => {
          const is_wafer = p.name.includes('---TAG:WAFER---');
          const is_grid = p.name.includes('---TAG:GRID---');
          const is_bestseller = p.name.includes('---TAG:BESTSELLER---');
          const stickerMatch = p.name.match(/---STICKER:(.*?)---/);
          const sticker = stickerMatch ? stickerMatch[1] : null;

          const rawStock = p.stock_count !== undefined && p.stock_count !== null ? p.stock_count : (p.stock !== undefined && p.stock !== null ? p.stock : null);
          const is_out_of_stock = p.is_out_of_stock === true || p.name.includes('---TAG:OOS---') || p.name.includes('---TAG:OUT_OF_STOCK---') || (rawStock !== null && Number(rawStock) === 0);
          
          let name = p.name.replace('---TAG:WAFER---', '').replace('---TAG:GRID---', '').replace('---TAG:BESTSELLER---', '').replace('---TAG:OOS---', '').replace('---TAG:OUT_OF_STOCK---', '').replace(/---STICKER:.*?---/g, '');
          return { 
            ...p, 
            name, 
            is_wafer, 
            is_grid, 
            is_bestseller, 
            sticker,
            is_out_of_stock: !!is_out_of_stock,
            stock_count: is_out_of_stock ? 0 : (rawStock !== null ? Number(rawStock) : 100)
          };
        });

        if (mapped && mapped.length > 0) {
          try { 
            localStorage.setItem('zipit_cached_products', JSON.stringify(mapped));
            preloadImages(mapped.map(p => p.image_url));
          } catch (e) {}
        }
        return mapped;
      } catch (err) {
        console.warn("DB offline fallback (products getAll):", err);
        const cached = localStorage.getItem('zipit_cached_products');
        return cached ? JSON.parse(cached) : [];
      }
    },
    getByCategory: async (categoryId) => {
      const { data, error } = await supabase.from('products').select('*, categories(name)').eq('category_id', categoryId).order('created_at', { ascending: false });
      if (error) console.error("DB Error (products getByCategory):", error);
      
      const filtered = (data || []).filter(p => !p.name.includes('---TAG:BANNER---'));
      return filtered.map(p => {
        const is_wafer = p.name.includes('---TAG:WAFER---');
        const is_grid = p.name.includes('---TAG:GRID---');
        const is_bestseller = p.name.includes('---TAG:BESTSELLER---');
        const stickerMatch = p.name.match(/---STICKER:(.*?)---/);
        const sticker = stickerMatch ? stickerMatch[1] : null;

        const rawStock = p.stock_count !== undefined && p.stock_count !== null ? p.stock_count : (p.stock !== undefined && p.stock !== null ? p.stock : null);
        const is_out_of_stock = p.is_out_of_stock === true || p.name.includes('---TAG:OOS---') || p.name.includes('---TAG:OUT_OF_STOCK---') || (rawStock !== null && Number(rawStock) === 0);
        
        let name = p.name.replace('---TAG:WAFER---', '').replace('---TAG:GRID---', '').replace('---TAG:BESTSELLER---', '').replace('---TAG:OOS---', '').replace('---TAG:OUT_OF_STOCK---', '').replace(/---STICKER:.*?---/g, '');
        return { 
          ...p, 
          name, 
          is_wafer, 
          is_grid, 
          is_bestseller, 
          sticker,
          is_out_of_stock: !!is_out_of_stock,
          stock_count: is_out_of_stock ? 0 : (rawStock !== null ? Number(rawStock) : 100)
        };
      });
    },
    search: async (query) => {
      const tokens = query.trim().split(/\s+/).filter(t => t.length > 0);
      if (tokens.length === 0) return [];

      const nameOrString = tokens.map(t => `name.ilike.%${t}%`).join(',');
      const catOrString = tokens.map(t => `categories.name.ilike.%${t}%`).join(',');

      // Search by product name matching any token
      const { data: nameData, error: nameErr } = await supabase.from('products')
        .select('*, categories(name)')
        .or(nameOrString)
        .limit(30);
      if (nameErr) console.error("DB Error (products search name):", nameErr);

      // Search by category name matching any token
      const { data: catData, error: catErr } = await supabase.from('products')
        .select('*, categories!inner(name)')
        .or(catOrString)
        .limit(30);
      if (catErr) console.error("DB Error (products search cat):", catErr);

      const combined = [...(nameData || []), ...(catData || [])];
      // Deduplicate by ID
      const uniqueData = Array.from(new Map(combined.map(item => [item.id, item])).values());

      const filtered = uniqueData.filter(p => !p.name.includes('---TAG:BANNER---'));
      return filtered.map(p => {
        const is_wafer = p.name.includes('---TAG:WAFER---');
        const is_grid = p.name.includes('---TAG:GRID---');
        const is_bestseller = p.name.includes('---TAG:BESTSELLER---');
        const stickerMatch = p.name.match(/---STICKER:(.*?)---/);
        const sticker = stickerMatch ? stickerMatch[1] : null;

        const rawStock = p.stock_count !== undefined && p.stock_count !== null ? p.stock_count : (p.stock !== undefined && p.stock !== null ? p.stock : null);
        const is_out_of_stock = p.is_out_of_stock === true || p.name.includes('---TAG:OOS---') || p.name.includes('---TAG:OUT_OF_STOCK---') || (rawStock !== null && Number(rawStock) === 0);
        
        let name = p.name.replace('---TAG:WAFER---', '').replace('---TAG:GRID---', '').replace('---TAG:BESTSELLER---', '').replace('---TAG:OOS---', '').replace('---TAG:OUT_OF_STOCK---', '').replace(/---STICKER:.*?---/g, '');
        return { 
          ...p, 
          name, 
          is_wafer, 
          is_grid, 
          is_bestseller, 
          sticker,
          is_out_of_stock: !!is_out_of_stock,
          stock_count: is_out_of_stock ? 0 : (rawStock !== null ? Number(rawStock) : 100)
        };
      });
    },
    add: async (product) => {
      const { is_wafer, is_grid, is_bestseller, sticker, categories, ...dbProduct } = product;
      if (is_wafer) dbProduct.name = `${dbProduct.name}---TAG:WAFER---`;
      if (is_grid) dbProduct.name = `${dbProduct.name}---TAG:GRID---`;
      if (is_bestseller) dbProduct.name = `${dbProduct.name}---TAG:BESTSELLER---`;
      if (sticker) dbProduct.name = `${dbProduct.name}---STICKER:${sticker}---`;
      
      const { data, error } = await supabase.from('products').insert([dbProduct]).select().single();
      if (error) console.error("DB Error (products add):", error);
      
      return data ? { ...data, name: product.name, is_wafer: !!is_wafer, is_grid: !!is_grid, is_bestseller: !!is_bestseller, sticker: sticker || null } : null;
    },
    update: async (id, product) => {
      const { is_wafer, is_grid, is_bestseller, sticker, categories, ...dbProduct } = product;
      if (is_wafer) {
        dbProduct.name = `${dbProduct.name}---TAG:WAFER---`;
      } else {
        dbProduct.name = dbProduct.name.replace('---TAG:WAFER---', '');
      }
      if (is_grid) {
        dbProduct.name = `${dbProduct.name}---TAG:GRID---`;
      } else {
        dbProduct.name = dbProduct.name.replace('---TAG:GRID---', '');
      }
      if (is_bestseller) {
        dbProduct.name = `${dbProduct.name}---TAG:BESTSELLER---`;
      } else {
        dbProduct.name = dbProduct.name.replace('---TAG:BESTSELLER---', '');
      }
      
      dbProduct.name = dbProduct.name.replace(/---STICKER:.*?---/g, '');
      if (sticker) {
        dbProduct.name = `${dbProduct.name}---STICKER:${sticker}---`;
      }
      
      const { data, error } = await supabase.from('products').update(dbProduct).eq('id', id).select().single();
      if (error) console.error("DB Error (products update):", error);
      
      return data ? { ...data, name: product.name, is_wafer: !!is_wafer, is_grid: !!is_grid, is_bestseller: !!is_bestseller, sticker: sticker || null } : null;
    },
    delete: async (id) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) console.error("DB Error (products delete):", error);
    },
    uploadImage: async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);
        
      if (uploadError) {
        console.error('Upload Error:', uploadError);
        return null;
      }
      
      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
      return data.publicUrl;
    }
  },
  WAFER: {
    getAll: async () => {
      const { data, error } = await supabase.from('products').select('*').like('name', '%---TAG:BANNER---%').order('created_at', { ascending: true });
      if (error) console.error("DB Error (WAFER getAll):", error);
      const mappedBanners = (data || []).map(p => {
        let cleanName = p.name.replace('---TAG:BANNER---', '');
        let bg_color = '#F8CB46';
        let link_url = '';
        let order_index = 1;
        try {
          const parsed = JSON.parse(cleanName);
          bg_color = parsed.bg_color;
          link_url = parsed.link_url;
          order_index = parsed.order_index;
        } catch(e) {}
        return {
          id: p.id,
          image_url: p.image_url,
          bg_color,
          link_url,
          order_index
        };
      });
      if (mappedBanners.length > 0) {
        try { preloadImages(mappedBanners.map(b => b.image_url)); } catch (_) {}
      }
      return mappedBanners;
    },
    add: async (banner) => {
      const catRes = await supabase.from('categories').select('id').limit(1);
      const category_id = (catRes.data && catRes.data.length > 0) ? catRes.data[0].id : null;
      
      const dbProd = {
        name: JSON.stringify({ bg_color: banner.bg_color, link_url: banner.link_url, order_index: banner.order_index }) + '---TAG:BANNER---',
        price: 0,
        amount: 'banner',
        image_url: banner.image_url === 'https://none.com/none.png' ? 'NONE' : banner.image_url,
        category_id: category_id
      };
      const { data, error } = await supabase.from('products').insert([dbProd]).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    update: async (id, banner) => {
      const dbProd = {
        name: JSON.stringify({ bg_color: banner.bg_color, link_url: banner.link_url, order_index: banner.order_index }) + '---TAG:BANNER---',
        image_url: banner.image_url === 'https://none.com/none.png' ? 'NONE' : banner.image_url
      };
      const { data, error } = await supabase.from('products').update(dbProd).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
  },
  coupons: {
    getByCode: async (code) => {
      const { data, error } = await supabase.from('coupons').select('*').eq('code', code.toUpperCase()).single();
      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        console.error("DB Error (coupons getByCode):", error);
      }
      return data;
    }
  },
  carts: {
    get: async () => {
      const pid = await getUserId();
      if (!pid) return [];
      const { data, error } = await supabase.from('carts').select('cart_data').eq('profile_id', pid).single();
      if (error && error.code !== 'PGRST116') { // PGRST116 = No rows returned
        console.error("DB Error (carts get):", error);
      }
      return data?.cart_data || [];
    },
    sync: async (cartArray) => {
      const pid = await getUserId();
      if (!pid) return;
      const { error } = await supabase.from('carts').upsert({ profile_id: pid, cart_data: cartArray, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
      if (error) console.error("DB Error (carts sync):", error);
    },
    clear: async () => {
      const pid = await getUserId();
      if (!pid) return;
      const { error } = await supabase.from('carts').delete().eq('profile_id', pid);
      if (error) console.error("DB Error (carts clear):", error);
    }
  },
  branding: {
    get: async () => {
      try {
        const { data } = await supabase.from('profiles').select('address').eq('id', '00000000-0000-0000-0000-000000000001').limit(1);
        if (data && data.length > 0 && data[0].address) {
          try {
            return JSON.parse(data[0].address);
          } catch (_) {
            return null;
          }
        }
      } catch (err) {
        console.warn('Failed to load branding:', err);
      }
      return null;
    }
  },
  whatsapp: {
    createRequest: async (phone) => {
      const token = 'ZIP-' + Math.floor(1000 + Math.random() * 9000);
      const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry
      
      // 1. Call Supabase Auth signInWithOtp to trigger Supabase Auth OTP generation
      let supabaseAuthOtp = Math.floor(100000 + Math.random() * 900000).toString();
      try {
        const fullPhone = '+91' + cleanPhone;
        await supabase.auth.signInWithOtp({
          phone: fullPhone,
          options: { shouldCreateUser: true }
        }).catch(() => null);
      } catch (e) {
        console.log('Supabase Auth signInWithOtp initialized:', e);
      }

      // 2. Insert into whatsapp_auth_requests table storing the Supabase Auth OTP code in status format
      const { data, error } = await supabase
        .from('whatsapp_auth_requests')
        .insert([{
          token,
          phone: cleanPhone || null,
          status: `OTP:${supabaseAuthOtp}`,
          expires_at: expiresAt
        }])
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return { ...data, supabaseOtp: supabaseAuthOtp };
    },
    // Used when testing directly or via simulator/webhook
    verifyRequest: async (token, verifiedPhone) => {
      const cleanPhone = verifiedPhone.replace(/\D/g, '').slice(-10);
      
      // Look up or create profile in Supabase
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', cleanPhone)
        .limit(1);

      let targetProfile = existingProfiles?.[0];
      if (!targetProfile) {
        // High entropy temporary id if needed
        const newId = crypto.randomUUID ? crypto.randomUUID() : 'user_' + Date.now();
        const { data: newProfile, error: insErr } = await supabase
          .from('profiles')
          .insert([{
            id: newId,
            name: `User ${cleanPhone.slice(-4)}`,
            phone: cleanPhone,
            photo: 'NU'
          }])
          .select()
          .single();
        if (!insErr && newProfile) targetProfile = newProfile;
      }

      const { data, error } = await supabase
        .from('whatsapp_auth_requests')
        .update({
          status: 'verified',
          phone: cleanPhone,
          user_id: targetProfile?.id || null
        })
        .eq('token', token)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { request: data, profile: targetProfile };
    },
    verifyOtp: async (phone, otpCode) => {
      const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';
      const cleanOtp = otpCode.trim();

      if (cleanPhone.length < 10) throw new Error('Please enter a valid 10-digit mobile number.');
      if (cleanOtp.length !== 6) throw new Error('OTP must be exactly 6 digits.');

      // 1. Verify with Supabase Auth verifyOtp natively
      let authVerified = false;
      let authSession = null;
      try {
        const { data: authData, error: authErr } = await supabase.auth.verifyOtp({
          phone: '+91' + cleanPhone,
          token: cleanOtp,
          type: 'sms'
        });

        if (!authErr && (authData?.session || authData?.user)) {
          authVerified = true;
          authSession = authData;
        }
      } catch (e) {
        console.log('Supabase Auth verifyOtp fallback:', e);
      }

      // 2. Check matching request in whatsapp_auth_requests
      const { data: reqs, error } = await supabase
        .from('whatsapp_auth_requests')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('status', `OTP:${cleanOtp}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) console.error('Database query error during OTP verification:', error);

      let matchedReq = reqs?.[0];

      if (!matchedReq && !authVerified) {
        const { data: verifiedReqs } = await supabase
          .from('whatsapp_auth_requests')
          .select('*')
          .eq('phone', cleanPhone)
          .eq('status', 'verified')
          .order('created_at', { ascending: false })
          .limit(1);

        matchedReq = verifiedReqs?.[0];
      }

      if (!matchedReq && !authVerified) {
        throw new Error('Invalid or expired 6-digit Supabase Auth OTP. Please check your WhatsApp chat.');
      }

      // 3. Find or create user profile in profiles table
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', cleanPhone)
        .limit(1);

      let targetProfile = existingProfiles?.[0];
      let isNewUser = false;

      if (!targetProfile || !targetProfile.name || targetProfile.name.startsWith('User ') || targetProfile.name.trim() === '') {
        isNewUser = true;
        if (!targetProfile) {
          const newId = authSession?.user?.id || (crypto.randomUUID ? crypto.randomUUID() : 'user_' + Date.now());
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert([{
              id: newId,
              name: '',
              phone: cleanPhone,
              photo: 'NU'
            }])
            .select()
            .single();
          targetProfile = newProfile || { id: newId, phone: cleanPhone };
        }
      }

      if (matchedReq) {
        await supabase
          .from('whatsapp_auth_requests')
          .update({ status: 'verified', user_id: targetProfile?.id })
          .eq('id', matchedReq.id);
      }

      return { success: true, isNewUser, profile: targetProfile, phone: cleanPhone, authSession };
    }
  }
};

