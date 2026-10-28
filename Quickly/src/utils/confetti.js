// Premium Real Grocery Items PNGs & Ribbon Confetti
const GROCERY_PNG_ITEMS = [
  '/categories/chips.png',
  '/categories/dairy.png',
  '/categories/veg-fruits.png',
  '/categories/atta-dal.png',
  '/categories/oil-ghee.png',
  '/icons/icon-192.png'
];

export const triggerConfetti = () => {
  const container = document.createElement('div');
  container.className = 'premium-confetti-container';
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.innerHTML = `
      @keyframes grocery-item-fall {
        0% {
          transform: translateY(0) rotate(0deg) scale(0.6);
          opacity: 0;
        }
        12% {
          opacity: 1;
        }
        85% {
          opacity: 0.95;
        }
        100% {
          transform: translateY(115vh) rotate(540deg) scale(1);
          opacity: 0;
        }
      }

      @keyframes metallic-ribbon-fall {
        0% {
          transform: translateY(0) rotateX(0deg) rotateZ(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(115vh) rotateX(720deg) rotateZ(360deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 1. Drop Real Grocery Items PNGs (28 floating products)
  for (let i = 0; i < 28; i++) {
    const itemEl = document.createElement('div');
    const imgSrc = GROCERY_PNG_ITEMS[i % GROCERY_PNG_ITEMS.length];
    const left = Math.random() * 92 + 4; // 4% to 96%
    const animDuration = Math.random() * 2.2 + 2.0; // 2.0s to 4.2s
    const delay = Math.random() * 0.45;
    const size = Math.floor(Math.random() * 14 + 32); // 32px to 46px

    itemEl.style.position = 'absolute';
    itemEl.style.left = `${left}%`;
    itemEl.style.top = '-55px';
    itemEl.style.width = `${size}px`;
    itemEl.style.height = `${size}px`;
    itemEl.style.opacity = '0';
    itemEl.style.filter = 'drop-shadow(0 6px 14px rgba(0,0,0,0.18))';
    itemEl.style.animation = `grocery-item-fall ${animDuration}s cubic-bezier(0.25, 1, 0.5, 1) ${delay}s forwards`;

    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = 'grocery';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';

    itemEl.appendChild(img);
    container.appendChild(itemEl);
  }

  // 2. Drop Metallic Festive Ribbons (Golden, Green, Amber & Orange)
  const ribbonColors = ['#10B981', '#FF6B00', '#F8CB46', '#22C55E', '#3B82F6', '#EC4899'];
  for (let j = 0; j < 45; j++) {
    const ribbon = document.createElement('div');
    const color = ribbonColors[Math.floor(Math.random() * ribbonColors.length)];
    const left = Math.random() * 98 + 1;
    const animDuration = Math.random() * 2.0 + 1.8;
    const delay = Math.random() * 0.35;
    const width = Math.random() * 6 + 6;
    const height = Math.random() * 14 + 10;

    ribbon.style.position = 'absolute';
    ribbon.style.left = `${left}%`;
    ribbon.style.top = '-25px';
    ribbon.style.width = `${width}px`;
    ribbon.style.height = `${height}px`;
    ribbon.style.backgroundColor = color;
    ribbon.style.borderRadius = '3px';
    ribbon.style.boxShadow = `0 2px 6px ${color}55`;
    ribbon.style.animation = `metallic-ribbon-fall ${animDuration}s ease-in ${delay}s forwards`;

    container.appendChild(ribbon);
  }

  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 5000);
};

export const triggerMoneyConfetti = () => {
  triggerConfetti();
};
