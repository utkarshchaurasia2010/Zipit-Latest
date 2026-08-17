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
        // Use a random phone to avoid UNIQUE constraint errors if multiple test accounts are made
        const randomPhone = 'temp_' + Math.floor(Math.random() * 10000);
        const { data: newData, error: insertError } = await supabase.from('profiles').insert([{ 
          id: pid,
          name: 'New User', 
          phone: randomPhone, 
          email: '',
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
      if (!pid) return null;
      
      const { id, ...updateData } = formData;
      
      // Convert empty strings to null so Postgres doesn't throw a duplicate constraint error 
      // when multiple users have an empty phone number.
      if (updateData.phone === '') {
        updateData.phone = null;
      }
      
      // If email is empty, we remove it from the update payload to avoid crashing
      // if the 'email' column does not exist yet.
      if (updateData.email === '') {
        delete updateData.email;
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
        alert("Database Error: " + error.message);
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
    }
  },
  addresses: {
    getAll: async () => {
      const pid = await getUserId();
      if (!pid) return [];
      
      const profile = await db.user.get();
      const allAddresses = [];
      
      if (profile && profile.address) {
        allAddresses.push({
          id: 'primary',
          profile_id: pid,
          type: 'HOME',
          is_default: true,
          details: profile.address,
          phone: profile.phone || '',
          lat: profile.lat?.toString() || '28.4595',
          lng: profile.lng?.toString() || '77.0266',
          gps_area: profile.gps_area || localStorage.getItem('zipit_gps_area') || 'Sector 14, MG Road, Gurugram',
          google_maps_url: profile.google_maps_url || `https://maps.google.com/?q=${profile.lat},${profile.lng}`,
        });
      }

      const { data, error } = await supabase.from('addresses').select('*').eq('profile_id', pid).neq('type', 'WISHLIST');
      if (error) console.error("DB Error (addresses get):", error);
      
      const secondaryAddrs = (data || []).map(addr => {
        let details = addr.details || '';
        let phone = '';
        let lat = '28.4595';
        let lng = '77.0266';
        let gps_area = localStorage.getItem('zipit_gps_area') || 'Sector 14, MG Road, Gurugram';
        let google_maps_url = '';

        if (details.includes('---TAG:PHONE:')) {
          phone = details.split('---TAG:PHONE:')[1]?.split('---')[0] || '';
        }
        if (details.includes('---TAG:LAT:')) {
          lat = details.split('---TAG:LAT:')[1]?.split('---')[0] || lat;
        }
        if (details.includes('---TAG:LNG:')) {
          lng = details.split('---TAG:LNG:')[1]?.split('---')[0] || lng;
        }
        if (details.includes('---TAG:GPS_AREA:')) {
          gps_area = details.split('---TAG:GPS_AREA:')[1]?.split('---')[0] || gps_area;
        }
        if (details.includes('---TAG:GMAPS:')) {
          google_maps_url = details.split('---TAG:GMAPS:')[1]?.split('---')[0] || `https://maps.google.com/?q=${lat},${lng}`;
        }
        if (details.includes('\n---TAG:')) {
          details = details.split('\n---TAG:')[0];
        } else if (details.includes('---TAG:')) {
          details = details.split('---TAG:')[0];
        }

        addr.details = details.trim();
        addr.phone = phone;
        addr.lat = lat;
        addr.lng = lng;
        addr.gps_area = gps_area;
        addr.google_maps_url = google_maps_url || `https://maps.google.com/?q=${lat},${lng}`;
        addr.is_default = false; // secondary addresses are not default
        return addr;
      });
      
      return [...allAddresses, ...secondaryAddrs];
    },
    add: async (addr) => {
      const pid = await getUserId();
      if (!pid) return null;
      
      const profile = await db.user.get();
      const userName = profile?.name || 'Unknown';
      
      const payload = { ...addr };
      const { phone, lat, lng, gps_area, google_maps_url } = payload;
      let cleanDetails = payload.details || '';
      if (cleanDetails.includes('\n---TAG:')) cleanDetails = cleanDetails.split('\n---TAG:')[0];
      else if (cleanDetails.includes('---TAG:')) cleanDetails = cleanDetails.split('---TAG:')[0];

      if (!profile || !profile.address) {
        // First address, make it primary!
        const { data, error } = await supabase.from('profiles').update({
          address: cleanDetails,
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          gps_area: gps_area || null,
          google_maps_url: google_maps_url || null,
          phone: phone || profile?.phone
        }).eq('id', pid).select().single();
        if (error) throw new Error(error.message);
        return { id: 'primary', ...data };
      }

      // Already has primary, save as secondary in addresses table
      const tags = [
        phone ? `---TAG:PHONE:${phone}---` : '',
        lat ? `---TAG:LAT:${lat}---` : '',
        lng ? `---TAG:LNG:${lng}---` : '',
        gps_area ? `---TAG:GPS_AREA:${gps_area}---` : '',
        google_maps_url ? `---TAG:GMAPS:${google_maps_url}---` : '',
        `---TAG:NAME:${userName}---`
      ].filter(Boolean).join('\n');

      payload.details = `${cleanDetails}\n${tags}`;
      delete payload.phone; delete payload.lat; delete payload.lng; delete payload.gps_area; delete payload.map_full_address; delete payload.google_maps_url;
      
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
      const { phone, lat, lng, gps_area, google_maps_url } = payload;
      let cleanDetails = payload.details || '';
      if (cleanDetails.includes('\n---TAG:')) cleanDetails = cleanDetails.split('\n---TAG:')[0];
      else if (cleanDetails.includes('---TAG:')) cleanDetails = cleanDetails.split('---TAG:')[0];

      if (id === 'primary') {
        const { data, error } = await supabase.from('profiles').update({
          address: cleanDetails,
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          gps_area: gps_area || null,
          google_maps_url: google_maps_url || null,
          phone: phone || profile?.phone
        }).eq('id', pid).select().single();
        if (error) throw new Error(error.message);
        return { id: 'primary', ...data };
      }

      const tags = [
        phone ? `---TAG:PHONE:${phone}---` : '',
        lat ? `---TAG:LAT:${lat}---` : '',
        lng ? `---TAG:LNG:${lng}---` : '',
        gps_area ? `---TAG:GPS_AREA:${gps_area}---` : '',
        google_maps_url ? `---TAG:GMAPS:${google_maps_url}---` : '',
        `---TAG:NAME:${userName}---`
      ].filter(Boolean).join('\n');

      payload.details = `${cleanDetails}\n${tags}`;
      delete payload.phone; delete payload.lat; delete payload.lng; delete payload.gps_area; delete payload.map_full_address; delete payload.google_maps_url;

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
    updateStatus: async (id, status) => {
      const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
      if (error) console.error("DB Error (orders updateStatus):", error);
      return data;
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
      const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      if (error) console.error("DB Error (categories get):", error);
      return data || [];
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
      const { data, error } = await supabase.from('products').select('*, categories(name)').order('created_at', { ascending: false });
      if (error) console.error("DB Error (products getAll):", error);
      
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
