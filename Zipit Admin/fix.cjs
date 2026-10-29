const fs = require('fs');
const file = 'D:/Zipit Admin/src/components/AdminDashboard.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
const fixedLines = [...lines.slice(0, 1156), '      )}', '', ...lines.slice(1353)];
fs.writeFileSync(file, fixedLines.join('\n'));
console.log('Fixed!');
