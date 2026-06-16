const fs = require('fs');

const content = fs.readFileSync('./client/js/app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('checkMobileDrawerLayout')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
process.exit(0);
