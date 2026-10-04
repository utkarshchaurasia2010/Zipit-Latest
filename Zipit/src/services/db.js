import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbaggauqnlcohrgvsios.supabase.co';
const supabaseAnonKey = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
};

export const db = {
  user: {
    get: async () => {
      const pid = await getUserId();
      if (!pid) return null;
      
      const { data, error } = await supabase.from('profiles').select('*').eq('id', pid).single();
      
      if (!data) {
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

      const profile = await db.user.get();
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

      const { data, error } = await supabase.from('addresses').select('*').eq('profile_id', pid).neq('type', 'WISHLIST');
      if (error) console.error("DB Error (addresses get):", error);
      
      const secondaryAddrs = (data || []).map(addr => {
        const parsed = extractAddressInfo(addr.details, {
          lat: '28.4595',
          lng: '77.0266'
        });

        return {
          ...addr,
          ...parsed,
          is_default: false // secondary addresses are not default
        };
      });
      
      return [...allAddresses, ...secondaryAddrs];
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
      const { data, error } = await supabase.from('orders').insert([{
        profile_id: pid,
        items: orderData.items,
        total: orderData.total,
        delivery_address: orderData.address,
        payment_method: orderData.paymentMethod,
        status: orderData.paymentMethod === 'UPI' ? 'Payment Pending' : 'Preparing',
        delivery_charge: orderData.deliveryCharge,
        small_cart_charge: orderData.smallCartCharge,
        applied_coupon: orderData.appliedCoupon || null,
        discount_amount: orderData.discountAmount || 0
      }]).select().single();
      if (error) {
        console.error("DB Error (orders add):", error);
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
          try { localStorage.setItem('zipit_cached_categories', JSON.stringify(data)); } catch (e) {}
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
          
          let name = p.name.replace('---TAG:WAFER---', '').replace('---TAG:GRID---', '').replace('---TAG:BESTSELLER---', '').replace(/---STICKER:.*?---/g, '');
          return { ...p, name, is_wafer, is_grid, is_bestseller, sticker };
        });

        if (mapped && mapped.length > 0) {
          try { localStorage.setItem('zipit_cached_products', JSON.stringify(mapped)); } catch (e) {}
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
        
        let name = p.name.replace('---TAG:WAFER---', '').replace('---TAG:GRID---', '').replace('---TAG:BESTSELLER---', '').replace(/---STICKER:.*?---/g, '');
        return { ...p, name, is_wafer, is_grid, is_bestseller, sticker };
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
        
        let name = p.name.replace('---TAG:WAFER---', '').replace('---TAG:GRID---', '').replace('---TAG:BESTSELLER---', '').replace(/---STICKER:.*?---/g, '');
        return { ...p, name, is_wafer, is_grid, is_bestseller, sticker };
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
      return (data || []).map(p => {
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
  }
};
