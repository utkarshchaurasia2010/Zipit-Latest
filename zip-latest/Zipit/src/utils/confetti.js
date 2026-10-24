export const triggerConfetti = () => {
  const colors = ['#F8CB46', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#FF9800'];
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '999999';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const animDuration = Math.random() * 2.5 + 1.5;
    const delay = Math.random() * 0.5;
    
    confetti.style.position = 'absolute';
    confetti.style.width = '8px';
    confetti.style.height = '16px';
    confetti.style.backgroundColor = color;
    confetti.style.left = `${left}%`;
    confetti.style.top = '-20px';
    confetti.style.opacity = '0';
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    confetti.style.animation = `confetti-fall ${animDuration}s ease-in ${delay}s forwards`;
    
    container.appendChild(confetti);
  }

  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.innerHTML = `
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 4500);
};

export const triggerMoneyConfetti = () => {
  const container = document.createElement('div');
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
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const moneyEmojis = ['💸', '💵', '💰', '🤑'];

  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement('div');
    const emoji = moneyEmojis[Math.floor(Math.random() * moneyEmojis.length)];
    const left = Math.random() * 100;
    const animDuration = Math.random() * 2 + 1.5;
    const delay = Math.random() * 0.3;
    
    confetti.innerHTML = emoji;
    confetti.style.position = 'absolute';
    confetti.style.fontSize = `${Math.random() * 10 + 20}px`;
    confetti.style.left = `${left}%`;
    confetti.style.top = '-40px';
    confetti.style.opacity = '0';
    confetti.style.animation = `confetti-fall ${animDuration}s ease-in ${delay}s forwards`;
    
    container.appendChild(confetti);
  }

  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 4000);
};
