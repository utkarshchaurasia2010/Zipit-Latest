// Elegant, High-Performance Festive & Savings Confetti (Pure Vector & CSS, No Image Dropping)

export const triggerConfetti = () => {
  const container = document.createElement('div');
  container.className = 'festive-confetti-container';
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  if (!document.getElementById('festive-confetti-style')) {
    const style = document.createElement('style');
    style.id = 'festive-confetti-style';
    style.innerHTML = `
      @keyframes confetti-flutter-fall {
        0% {
          transform: translateY(0) rotateX(0deg) rotateZ(0deg);
          opacity: 1;
        }
        75% {
          opacity: 1;
        }
        100% {
          transform: translateY(112vh) rotateX(720deg) rotateZ(360deg);
          opacity: 0;
        }
      }

      @keyframes confetti-sparkle-spin {
        0% {
          transform: translateY(0) rotate(0deg) scale(0.8);
          opacity: 1;
        }
        50% {
          transform: translateY(50vh) rotate(180deg) scale(1.1);
          opacity: 0.9;
        }
        100% {
          transform: translateY(112vh) rotate(360deg) scale(0.6);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const vibrantColors = [
    '#F8CB46', // Brand yellow / gold
    '#10B981', // Emerald green
    '#FF6B00', // Zipit orange
    '#3B82F6', // Vibrant blue
    '#EC4899', // Celebration pink
    '#8B5CF6', // Purple
    '#EF4444'  // Festive crimson
  ];

  // 1. Festive Confetti Ribbons & Rectangles (60 pieces)
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    const color = vibrantColors[i % vibrantColors.length];
    const left = Math.random() * 96 + 2;
    const duration = Math.random() * 1.8 + 2.0; // 2.0s to 3.8s
    const delay = Math.random() * 0.4;
    const width = Math.random() * 5 + 7; // 7px to 12px
    const height = Math.random() * 10 + 12; // 12px to 22px
    const isRound = Math.random() > 0.65;

    piece.style.position = 'absolute';
    piece.style.left = `${left}%`;
    piece.style.top = '-20px';
    piece.style.width = `${width}px`;
    piece.style.height = isRound ? `${width}px` : `${height}px`;
    piece.style.backgroundColor = color;
    piece.style.borderRadius = isRound ? '50%' : '3px';
    piece.style.boxShadow = `0 2px 6px ${color}66`;
    piece.style.willChange = 'transform, opacity';
    piece.style.animation = `confetti-flutter-fall ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s forwards`;

    container.appendChild(piece);
  }

  // 2. Shimmering Gold Stars / Sparkles (20 pieces)
  for (let j = 0; j < 20; j++) {
    const star = document.createElement('div');
    const left = Math.random() * 94 + 3;
    const duration = Math.random() * 1.5 + 2.2;
    const delay = Math.random() * 0.35;
    const size = Math.random() * 8 + 12;

    star.style.position = 'absolute';
    star.style.left = `${left}%`;
    star.style.top = '-24px';
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.color = '#F8CB46';
    star.innerHTML = `
      <svg viewBox="0 0 24 24" fill="#F8CB46" width="100%" height="100%">
        <path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/>
      </svg>
    `;
    star.style.filter = 'drop-shadow(0 2px 8px rgba(248, 203, 70, 0.6))';
    star.style.willChange = 'transform, opacity';
    star.style.animation = `confetti-sparkle-spin ${duration}s ease-in-out ${delay}s forwards`;

    container.appendChild(star);
  }

  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 4500);
};

// Specialized Coupon / Savings Celebration (Golden ₹ Savings Badges + Sparkles + Festive Ribbons)
export const triggerMoneyConfetti = () => {
  const container = document.createElement('div');
  container.className = 'savings-confetti-container';
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  if (!document.getElementById('savings-confetti-style')) {
    const style = document.createElement('style');
    style.id = 'savings-confetti-style';
    style.innerHTML = `
      @keyframes savings-coin-fall {
        0% {
          transform: translateY(0) rotateY(0deg) scale(0.7);
          opacity: 0.2;
        }
        15% {
          opacity: 1;
        }
        85% {
          opacity: 1;
        }
        100% {
          transform: translateY(112vh) rotateY(720deg) scale(1);
          opacity: 0;
        }
      }

      @keyframes savings-ribbon-fall {
        0% {
          transform: translateY(0) rotateX(0deg) rotateZ(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(112vh) rotateX(540deg) rotateZ(360deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 1. Golden ₹ Savings Coins / Badges (16 coins)
  for (let i = 0; i < 16; i++) {
    const coin = document.createElement('div');
    const left = Math.random() * 90 + 5;
    const duration = Math.random() * 1.6 + 2.2; // 2.2s to 3.8s
    const delay = Math.random() * 0.35;
    const size = Math.random() * 8 + 26; // 26px to 34px

    coin.style.position = 'absolute';
    coin.style.left = `${left}%`;
    coin.style.top = '-40px';
    coin.style.width = `${size}px`;
    coin.style.height = `${size}px`;
    coin.style.borderRadius = '50%';
    coin.style.background = 'linear-gradient(135deg, #FFE066 0%, #F59E0B 100%)';
    coin.style.border = '2px solid #FFFBEB';
    coin.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.45)';
    coin.style.display = 'flex';
    coin.style.alignItems = 'center';
    coin.style.justifyContent = 'center';
    coin.style.color = '#78350F';
    coin.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    coin.style.fontSize = `${Math.round(size * 0.55)}px`;
    coin.style.fontWeight = '900';
    coin.textContent = '₹';
    coin.style.willChange = 'transform, opacity';
    coin.style.animation = `savings-coin-fall ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s forwards`;

    container.appendChild(coin);
  }

  // 2. Emerald Green & Golden Savings Confetti Ribbons (45 pieces)
  const savingsColors = ['#10B981', '#059669', '#F59E0B', '#F8CB46', '#34D399', '#FBBF24'];
  for (let j = 0; j < 45; j++) {
    const ribbon = document.createElement('div');
    const color = savingsColors[j % savingsColors.length];
    const left = Math.random() * 96 + 2;
    const duration = Math.random() * 1.8 + 2.0;
    const delay = Math.random() * 0.35;
    const width = Math.random() * 5 + 7;
    const height = Math.random() * 10 + 12;

    ribbon.style.position = 'absolute';
    ribbon.style.left = `${left}%`;
    ribbon.style.top = '-25px';
    ribbon.style.width = `${width}px`;
    ribbon.style.height = `${height}px`;
    ribbon.style.backgroundColor = color;
    ribbon.style.borderRadius = '3px';
    ribbon.style.boxShadow = `0 2px 6px ${color}55`;
    ribbon.style.willChange = 'transform, opacity';
    ribbon.style.animation = `savings-ribbon-fall ${duration}s ease-in ${delay}s forwards`;

    container.appendChild(ribbon);
  }

  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 4500);
};
