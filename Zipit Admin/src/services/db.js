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
      let admin = null;
      const pid = await getUserId();
      if (pid) {
        const { data } = await supabase.from('profiles').select('*').eq('id', pid).limit(1);
        if (data && data.length > 0) admin = data[0];
      }
      
      if (!admin) {
        const savedAdminId = localStorage.getItem('zipit_active_admin_id');
        if (savedAdminId) {
          const { data } = await supabase.from('profiles').select('*').eq('id', savedAdminId).limit(1);
          if (data && data.length > 0) admin = data[0];
        }
      }

      if (!admin) {
        const { data: adminUsers } = await supabase.from('profiles').select('*').eq('is_admin', true).limit(1);
        if (adminUsers && adminUsers.length > 0) admin = adminUsers[0];
      }

      if (admin) {
        // Extract 6-digit admin code if stored in address tag format: "---ADMIN_CODE:123456---"
        const codeMatch = admin.address?.match(/---ADMIN_CODE:(\d{6})---/);
        const admin_code = codeMatch ? codeMatch[1] : (localStorage.getItem('zipit_admin_custom_code') || '737920');
        const cleanAddress = admin.address ? admin.address.replace(/---ADMIN_CODE:\d{6}---/g, '').trim() : '';
        return { ...admin, admin_code, address: cleanAddress };
      }
      return null;
    },
    update: async (formData) => {
      let pid = await getUserId();
      if (!pid && formData?.id) {
        pid = formData.id;
      }
      if (!pid) {
        const admin = await db.user.get();
        pid = admin?.id;
      }
      if (!pid) {
        return { error: 'No admin profile ID found to update.' };
      }
      
      const { id, created_at, addresses_list, admin_code, ...rawUpdateData } = formData;
      const updateData = { ...rawUpdateData };
      
      // Clean phone number
      if (updateData.phone === '') {
        updateData.phone = null;
      }
      
      if (updateData.email === '') {
        delete updateData.email;
      }

      // Check duplicate phone across other profiles
      if (updateData.phone) {
        const { data: existingPhone } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('phone', updateData.phone)
          .neq('id', pid)
          .limit(1);

        if (existingPhone && existingPhone.length > 0) {
          return { error: 'This phone number is already registered with another account. Please use a different phone number.' };
        }
      }

      // Check duplicate email across other profiles
      if (updateData.email) {
        const { data: existingEmail } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('email', updateData.email)
          .neq('id', pid)
          .limit(1);

        if (existingEmail && existingEmail.length > 0) {
          return { error: 'This email address is already registered with another account. Please use a different email address.' };
        }
      }

      // Save custom admin 6-digit code into address tag & localStorage so it persists across DB and client
      if (admin_code && /^\d{6}$/.test(admin_code)) {
        localStorage.setItem('zipit_admin_custom_code', admin_code);
        const currentAddr = updateData.address ? updateData.address.replace(/---ADMIN_CODE:\d{6}---/g, '').trim() : '';
        updateData.address = `${currentAddr}\n---ADMIN_CODE:${admin_code}---`.trim();
      }

      const { data, error } = await supabase.from('profiles').update(updateData).eq('id', pid).select();
      if (error) {
        console.error("DB Error (profiles update):", error);
        if (error.message.includes('profiles_phone_key') || error.code === '23505') {
          return { error: 'This phone number is already registered with another account. Please use a different phone number.' };
        }
        return { error: error.message };
      }

      let updatedRecord = data && data.length > 0 ? data[0] : null;

      if (!updatedRecord) {
        // Fallback upsert if no existing profile row matched pid
        const { data: upsertData, error: upsertErr } = await supabase.from('profiles').upsert([{ id: pid, ...updateData }]).select();
        if (upsertErr) {
          console.error("DB Error (profiles upsert):", upsertErr);
          return { error: upsertErr.message };
        }
        updatedRecord = upsertData && upsertData.length > 0 ? upsertData[0] : null;
      }

      if (!updatedRecord) {
        return { error: 'Failed to update profile in database.' };
      }

      const cleanAddress = updatedRecord.address ? updatedRecord.address.replace(/---ADMIN_CODE:\d{6}---/g, '').trim() : '';
      return { data: { ...updatedRecord, admin_code: admin_code || '737920', address: cleanAddress } };
    },
    getAllUsers: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) console.error("DB Error (profiles getAllUsers):", error);
      
      const [addrsRes, ordersRes] = await Promise.all([
        supabase.from('addresses').select('*'),
        supabase.from('orders').select('profile_id, delivery_address, created_at')
      ]);
      const addrs = addrsRes.data || [];
      const orders = ordersRes.data || [];

      const cleanAddr = (rawDetails) => {
        if (!rawDetails) return null;
        let details = typeof rawDetails === 'string' ? rawDetails : (rawDetails.details || '');
        details = details.replace(/[\s\n]*---[A-Z_]+:[^-\n]*---/g, '').trim();
        if (details.includes('---')) details = details.split('---')[0].trim();
        return details.trim() || null;
      };

      return (data || []).map(u => {
        const userAddressesList = [];
        
        if (u.address) {
          userAddressesList.push({
             type: 'PRIMARY',
             details: u.address,
             lat: u.lat,
             lng: u.lng,
             gps_area: u.gps_area,
             google_maps_url: u.google_maps_url,
             phone: u.phone
          });
        }
        
        const secondaries = addrs.filter(a => a.profile_id === u.id || (u.phone && a.details && a.details.includes(`---TAG:PHONE:${u.phone}---`)));
        secondaries.forEach(sec => {
          userAddressesList.push({
             type: sec.type || 'SECONDARY',
             details: cleanAddr(sec.details),
             phone: sec.details?.includes('---TAG:PHONE:') ? sec.details.split('---TAG:PHONE:')[1]?.split('---')[0] : null
          });
        });
        
        let displayAddr = cleanAddr(u.address);
        if (!displayAddr && userAddressesList.length > 0) {
           displayAddr = userAddressesList[0].details;
        }

        if (!displayAddr) {
          const userOrder = orders.find(o => o.profile_id === u.id || (u.phone && o.delivery_address?.phone === u.phone));
          if (userOrder && userOrder.delivery_address) {
             displayAddr = cleanAddr(userOrder.delivery_address.details || userOrder.delivery_address.address);
          }
        }
        return {
          ...u,
          address: displayAddr || 'No address saved',
          addresses_list: userAddressesList,
          created_at: u.created_at || new Date().toISOString()
        };
      });
    }
  },
  addresses: {
    getAll: async () => {
      const pid = await getUserId();
      if (!pid) return [];
      const { data, error } = await supabase.from('addresses').select('*').eq('profile_id', pid);
      if (error) console.error("DB Error (addresses get):", error);
      
      return (data || []).map(addr => {
        if (addr.details && addr.details.includes('\n---TAG:NAME:')) {
          addr.details = addr.details.split('\n---TAG:NAME:')[0];
        }
        return addr;
      });
    },
    add: async (addr) => {
      const pid = await getUserId();
      if (!pid) return null;
      
      const profile = await db.user.get();
      const userName = profile?.name || 'Unknown';
      
      const payload = { ...addr };
      if (payload.details) {
        payload.details = `${payload.details}\n---TAG:NAME:${userName}---`;
      }
      
      const { data, error } = await supabase.from('addresses').insert([{ ...payload, profile_id: pid }]).select().single();
      if (error) console.error("DB Error (addresses add):", error);
      return data;
    },
    update: async (id, addr) => {
      const payload = { ...addr };
      if (payload.details) {
        const profile = await db.user.get();
        const userName = profile?.name || 'Unknown';
        payload.details = `${payload.details}\n---TAG:NAME:${userName}---`;
      }
      const { data, error } = await supabase.from('addresses').update(payload).eq('id', id).select().single();
      if (error) console.error("DB Error (addresses update):", error);
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from('addresses').delete().eq('id', id);
      if (error) console.error("DB Error (addresses delete):", error);
    },
    setDefault: async (id) => {
      const pid = await getUserId();
      if (!pid) return;
      await supabase.from('addresses').update({ is_default: false }).eq('profile_id', pid);
      const { error } = await supabase.from('addresses').update({ is_default: true }).eq('id', id);
      if (error) console.error("DB Error (addresses setDefault):", error);
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
        small_cart_charge: orderData.smallCartCharge
      }]).select().single();
      if (error) {
        console.error("DB Error (orders add):", error);
        throw error;
      }
      return data;
    },
    getAllAdmin: async () => {
      // Fetch all orders with user profiles
      const { data, error } = await supabase.from('orders').select('*, profiles(name, phone)').order('created_at', { ascending: false });
      if (error) console.error("DB Error (orders getAllAdmin):", error);
      return data || [];
    },
    updateStatus: async (id, status) => {
      const { data, error } = await supabase.from('orders').update({ status }).eq('id', id).select('*, profiles(name, photo)').single();
      if (error) console.error("DB Error (orders updateStatus):", error);
      
      if (data && data.profiles && data.profiles.photo && data.profiles.photo.includes('|||')) {
        const token = data.profiles.photo.split('|||')[1];
        if (token && ['Out for delivery', 'Delivered'].includes(status)) {
           const title = status === 'Delivered' ? 'Order Delivered! 🎉' : 'Order Out for Delivery! 🚚';
           const body = status === 'Delivered' ? 'Your order has been delivered successfully. Enjoy!' : 'Your order is on its way to you!';
           try {
             fetch('/api/send-push', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ token, title, body })
             });
           } catch(e) { console.error('Push error:', e); }
        }
      }
      return data;
    },
    updateLocation: async (id, location) => {
      const { data: order, error: getErr } = await supabase.from('orders').select('delivery_address').eq('id', id).single();
      if (getErr) return null;
      
      const newAddr = { ...order.delivery_address, driverLocation: location };
      const { data, error } = await supabase.from('orders').update({ delivery_address: newAddr }).eq('id', id).select().single();
      if (error) console.error("DB Error (orders updateLocation):", error);
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
        
        const stockVal = p.stock !== undefined && p.stock !== null ? Number(p.stock) : (p.stock_count !== undefined && p.stock_count !== null ? Number(p.stock_count) : null);
        const is_out_of_stock = p.is_out_of_stock === true || p.name.includes('---TAG:OOS---') || p.name.includes('---TAG:OUT_OF_STOCK---') || (stockVal !== null && stockVal === 0);

        let name = p.name.replace('---TAG:WAFER---', '').replace('---TAG:GRID---', '').replace('---TAG:BESTSELLER---', '').replace(/---STICKER:.*?---/g, '').replace('---TAG:OOS---', '').replace('---TAG:OUT_OF_STOCK---', '');
        return { ...p, name, is_wafer, is_grid, is_bestseller, sticker, is_out_of_stock, stock_count: stockVal ?? (is_out_of_stock ? 0 : -1) };
      });
    },
    add: async (product) => {
      const { is_wafer, is_grid, is_bestseller, sticker, categories, ...dbProduct } = product;
      if (is_wafer) dbProduct.name = `${dbProduct.name}---TAG:WAFER---`;
      if (is_grid) dbProduct.name = `${dbProduct.name}---TAG:GRID---`;
      if (is_bestseller) dbProduct.name = `${dbProduct.name}---TAG:BESTSELLER---`;
      if (sticker) dbProduct.name = `${dbProduct.name}---STICKER:${sticker}---`;
      
      if (product.is_out_of_stock || dbProduct.stock_count === 0 || dbProduct.stock === 0) {
        dbProduct.name = `${dbProduct.name}---TAG:OOS---`;
        dbProduct.is_out_of_stock = true;
        dbProduct.stock = 0;
        dbProduct.stock_count = 0;
      } else {
        dbProduct.name = dbProduct.name.replace('---TAG:OOS---', '').replace('---TAG:OUT_OF_STOCK---', '');
        dbProduct.is_out_of_stock = false;
      }

      const { data, error } = await supabase.from('products').insert([dbProduct]).select().single();
      if (error) console.error("DB Error (products add):", error);
      
      return data ? { ...data, name: product.name, is_wafer: !!is_wafer, is_grid: !!is_grid, is_bestseller: !!is_bestseller, sticker: sticker || null, is_out_of_stock: !!dbProduct.is_out_of_stock } : null;
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

      if (product.is_out_of_stock || dbProduct.stock_count === 0 || dbProduct.stock === 0) {
        if (!dbProduct.name.includes('---TAG:OOS---')) {
          dbProduct.name = `${dbProduct.name}---TAG:OOS---`;
        }
        dbProduct.is_out_of_stock = true;
        dbProduct.stock = 0;
        dbProduct.stock_count = 0;
      } else {
        dbProduct.name = dbProduct.name.replace('---TAG:OOS---', '').replace('---TAG:OUT_OF_STOCK---', '');
        dbProduct.is_out_of_stock = false;
      }
      
      const { data, error } = await supabase.from('products').update(dbProduct).eq('id', id).select().single();
      if (error) console.error("DB Error (products update):", error);
      
      return data ? { ...data, name: product.name, is_wafer: !!is_wafer, is_grid: !!is_grid, is_bestseller: !!is_bestseller, sticker: sticker || null, is_out_of_stock: !!dbProduct.is_out_of_stock } : null;
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
    getAll: async () => {
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (error) console.error("DB Error (coupons getAll):", error);
      return data || [];
    },
    add: async (coupon) => {
      const { data, error } = await supabase.from('coupons').insert([coupon]).select().single();
      if (error) {
        console.error("DB Error (coupons add):", error);
        throw new Error(error.message);
      }
      return data;
    },
    update: async (id, coupon) => {
      const { data, error } = await supabase.from('coupons').update(coupon).eq('id', id).select().single();
      if (error) {
        console.error("DB Error (coupons update):", error);
        throw new Error(error.message);
      }
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) console.error("DB Error (coupons delete):", error);
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
        const { data, error } = await supabase.from('profiles').select('address').eq('id', '00000000-0000-0000-0000-000000000001').limit(1);
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
    },
    uploadLogo: async (roleKey, file) => {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `logos/${roleKey}_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('product-images').upload(fileName, file, {
        contentType: file.type || 'image/png',
        upsert: true
      });
      if (error) {
        throw new Error(error.message);
      }
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(fileName);
      return pub.publicUrl;
    },
    update: async (brandingData) => {
      const payload = {
        ...brandingData,
        updated_at: new Date().toISOString()
      };
      
      // Upsert profile record 00000000-0000-0000-0000-000000000001
      const { error } = await supabase.from('profiles').upsert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'App Branding System',
        phone: '0000000000',
        photo: 'SYSTEM',
        address: JSON.stringify(payload)
      }, { onConflict: 'id' });

      if (error) {
        throw new Error(error.message);
      }
      return payload;
    }
  }
};
