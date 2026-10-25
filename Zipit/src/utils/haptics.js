// Lightweight native haptic vibration helper for tactile mobile feedback
export const triggerHaptic = (type = 'light') => {
  if (typeof window === 'undefined' || !navigator.vibrate) return;

  try {
    switch (type) {
      case 'selection': // Ultra-light touch (e.g. quantity changes, tab switch)
        navigator.vibrate(8);
        break;
      case 'light': // Light click (e.g. ADD button, wishlist toggle)
        navigator.vibrate(14);
        break;
      case 'medium': // Action buttons (e.g. Apply Coupon, Open Cart)
        navigator.vibrate(22);
        break;
      case 'success': // Order placed, Payment success
        navigator.vibrate([15, 60, 25]);
        break;
      case 'error': // Validation warning, out of stock
        navigator.vibrate([40, 40, 40]);
        break;
      default:
        navigator.vibrate(12);
    }
  } catch (_) {
    // Vibration blocked or unsupported on desktop
  }
};
