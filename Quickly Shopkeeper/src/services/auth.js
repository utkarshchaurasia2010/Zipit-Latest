import { supabase } from './db';

export { supabase };

export const auth = {
  loginWithCode: async (code) => {
    const { data, error } = await supabase
      .from('access_codes')
      .select('role, is_active')
      .eq('code', code.toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Invalid access code.');
      }
      throw new Error(error.message);
    }

    if (data.is_active === false) {
      throw new Error('Your Shopkeeper ID has been deactivated by Admin. Please contact store management.');
    }
    
    // Store in localStorage to persist session
    localStorage.setItem('zipit_sales_role', data.role);
    localStorage.setItem('zipit_sales_code', code.toUpperCase());
    
    return data.role;
  },
  
  logout: () => {
    localStorage.removeItem('zipit_sales_role');
    localStorage.removeItem('zipit_sales_code');
    window.location.href = '/';
  },
  
  getRole: () => {
    return localStorage.getItem('zipit_sales_role');
  },

  getCode: () => {
    return localStorage.getItem('zipit_sales_code');
  }
};
