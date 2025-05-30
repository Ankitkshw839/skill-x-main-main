// Script to replace API key with placeholder during build
const fs = require('fs');
const path = require('path');

// Read the config file
const configPath = path.join(__dirname, 'config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace the API key with a placeholder
configContent = configContent.replace(
  /API_KEY: ['"].*['"]/,
  `API_KEY: '##API_KEY_PLACEHOLDER##'`
);

// Write the modified content back to the file
fs.writeFileSync(configPath, configContent);

console.log('API key replaced with placeholder for deployment'); 