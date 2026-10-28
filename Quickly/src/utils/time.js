// Calculate a stable pseudo-random delivery time for a specific product
export const getProductDeliveryTime = (productName) => {
  if (!productName) return 8;
  // Use length and char codes to get a stable number between 6 and 14
  let hash = 0;
  for (let i = 0; i < productName.length; i++) {
    hash += productName.charCodeAt(i);
  }
  return 6 + (hash % 9); 
};

// Calculate total cart delivery time dynamically based on items
export const getCartDeliveryTime = (cart = []) => {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  if (totalItems === 0) return 0;
  
  // Base 6 mins + 1 min per 3 items
  return 6 + Math.floor(totalItems / 3) + (totalItems % 3 === 0 ? 0 : 1);
};
