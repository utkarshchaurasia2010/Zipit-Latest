import { supabase } from './db';

export { supabase };

export const auth = {
  loginWithCode: async (codeInput, mobileInput = null) => {
    const cleanCode = codeInput.trim().toUpperCase();
    const cleanMobile = mobileInput ? mobileInput.trim().replace(/[^0-9]/g, '') : null;

    let query = supabase
      .from('access_codes')
      .select('*')
      .eq('code', cleanCode);

    const { data, error } = await query.single();

    if (error || !data) {
      throw new Error('Invalid Access Code. Please check code generated in Admin Panel.');
    }

    if (cleanMobile && data.mobile) {
      const dbMobile = data.mobile.replace(/[^0-9]/g, '');
      if (dbMobile !== cleanMobile && !dbMobile.endsWith(cleanMobile) && !cleanMobile.endsWith(dbMobile)) {
        throw new Error('Mobile number does not match the registered Access Code.');
      }
    }

    if (data.role !== 'rider') {
      throw new Error(`This code is registered for a ${data.role}. Please use a Rider access code.`);
    }
    
    // Store in localStorage to persist session
    localStorage.setItem('zipit_sales_role', data.role);
    localStorage.setItem('zipit_sales_code', cleanCode);
    
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
