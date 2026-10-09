import fs from 'fs';
import path from 'path';

const componentsDir = path.resolve('src/components');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Simple string replacements
  content = content.replace(/navigate\('home'\)/g, "navigate('/')");
  content = content.replace(/navigate\('categories'\)/g, "navigate('/categories')");
  content = content.replace(/navigate\('profile'\)/g, "navigate('/profile')");
  content = content.replace(/navigate\('orders'\)/g, "navigate('/orders')");
  content = content.replace(/navigate\('checkout'\)/g, "navigate('/checkout')");
  content = content.replace(/navigate\('payment'\)/g, "navigate('/payment')");
  content = content.replace(/navigate\('all-products'\)/g, "navigate('/all-products')");
  content = content.replace(/navigate\('saved-addresses'\)/g, "navigate('/saved-addresses')");
  content = content.replace(/navigate\('payment-methods'\)/g, "navigate('/payment-methods')");
  
  // Complex replacements with params (e.g. from CategoriesPage)
  // navigate('product-list', { category: cat.name, categoryId: cat.id })
  // We'll just regex anything that looks like navigate('product-list', ...)
  content = content.replace(/navigate\('product-list',\s*\{[^}]*categoryId:\s*([^,}\s]+)[^}]*\}\)/g, "navigate(`/category/${$1}`)");

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      replaceInFile(fullPath);
    }
  });
}

walkDir(componentsDir);
console.log("Migration complete.");
