// Script to insert API key from environment variables during Vercel build
const fs = require('fs');
const path = require('path');

// Get API key from environment variable
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('ERROR: OPENROUTER_API_KEY environment variable is not set');
  process.exit(1);
}

// Read the config file
const configPath = path.join(__dirname, 'config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace the placeholder with the actual API key
configContent = configContent.replace(
  /API_KEY: ['"]##API_KEY_PLACEHOLDER##['"]/,
  `API_KEY: '${apiKey}'`
);

// Write the modified content back to the file
fs.writeFileSync(configPath, configContent);

console.log('API key inserted from environment variables'); 