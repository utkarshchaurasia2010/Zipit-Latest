const fs = require('fs');
const path = require('path');

const replacements = [
  { file: 'ProfilePage.css', rules: [
    { from: 'background-color: #F3F4F6;', to: 'background-color: var(--color-background);' },
    { from: 'background-color: #FFF;', to: 'background-color: var(--color-surface);' }
  ]},
  { file: 'HistoryPage.css', rules: [
    { from: 'background-color: #F3F4F6;', to: 'background-color: var(--color-background);' },
    { from: 'background-color: #FFF;', to: 'background-color: var(--color-surface);' }
  ]},
  { file: 'Header.css', rules: [
    { from: 'background-color: #FFF;', to: 'background-color: var(--color-surface);' }
  ]},
  { file: 'SearchOverlay.css', rules: [
    { from: 'background: white;', to: 'background: var(--color-surface);' },
    { from: 'border: 1px solid #eee;', to: 'border: 1px solid var(--color-border);' },
    { from: 'background: #f8f9fa;', to: 'background: var(--color-surface-muted);' },
    { from: 'color: #333;', to: 'color: var(--color-text);' },
    { from: 'color: #000;', to: 'color: var(--color-text);' }
  ]},
  { file: 'ProductListPage.css', rules: [
    { from: 'background-color: #FFF;', to: 'background-color: var(--color-surface);' },
    { from: 'background-color: #F8F9FA;', to: 'background-color: var(--color-surface-muted);' },
    { from: 'color: #333;', to: 'color: var(--color-text);' }
  ]},
  { file: 'OrderSummaryPage.css', rules: [
    { from: 'background-color: #F3F4F6;', to: 'background-color: var(--color-background);' },
    { from: 'background-color: #FFF;', to: 'background-color: var(--color-surface);' }
  ]},
  { file: 'CartModal.css', rules: [
    { from: 'background-color: #F3F4F6;', to: 'background-color: var(--color-background);' },
    { from: 'background-color: #FFF;', to: 'background-color: var(--color-surface);' },
    { from: 'background: #FFF;', to: 'background: var(--color-surface);' }
  ]},
  { file: 'CategoriesPage.css', rules: [
    { from: 'background-color: #FFF;', to: 'background-color: var(--color-surface);' }
  ]},
  { file: 'AdminDashboard.css', rules: [
    { from: 'background: white;', to: 'background: var(--color-surface);' },
    { from: 'background-color: white;', to: 'background-color: var(--color-surface);' },
    { from: 'background-color: #f8f9fa;', to: 'background-color: var(--color-background);' },
    { from: 'border-bottom: 1px solid #eee;', to: 'border-bottom: 1px solid var(--color-border);' },
    { from: 'border: 1px solid #eee;', to: 'border: 1px solid var(--color-border);' }
  ]}
];

replacements.forEach(({ file, rules }) => {
  const filePath = path.join(__dirname, 'src', 'components', file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  rules.forEach(rule => {
    if (content.includes(rule.from)) {
      content = content.split(rule.from).join(rule.to);
      changed = true;
    }
  });
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
