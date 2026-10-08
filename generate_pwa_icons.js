const fs = require('fs');
const path = require('path');

// Simple script to generate valid 1x1 base PNG scaled up or create SVG fallback icons
const minimalPngBase64 = "iVBORw0KGgoAAAANSU56NTAKGAAAA1BMVEUADA8fWJjQAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5wgREQ45z12kKAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAE0lEQVQI12P4z8DAwMDABQAGAwEAy+M+vwAAAABJRU5ErkJggg==";

const riderPublicDir = path.join(__dirname, 'Zipit Rider', 'public');
const shopPublicDir = path.join(__dirname, 'Zipit Shopkeeper', 'public');

[riderPublicDir, shopPublicDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pwa-192x192.png'), Buffer.from(minimalPngBase64, 'base64'));
  fs.writeFileSync(path.join(dir, 'pwa-512x512.png'), Buffer.from(minimalPngBase64, 'base64'));
});

console.log('PWA Icons generated successfully!');
