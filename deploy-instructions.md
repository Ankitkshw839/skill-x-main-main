# Deployment Instructions

To safely deploy your application with the API key:

## Setup (one-time)

1. Install Vercel CLI:
   ```
   npm install -g vercel
   ```

2. Login to Vercel:
   ```
   vercel login
   ```

## Deploy

1. Make sure your changes are saved locally
2. Make sure `config.prod.js` contains your API key
3. Run the deployment command:
   ```
   vercel --prod
   ```

This will deploy directly from your local machine to Vercel, including the `config.prod.js` file that contains your API key, without pushing it to GitHub.

## Important Notes

- NEVER push `config.prod.js` to GitHub
- If you need to make changes to the code, update your local files first, then deploy using the Vercel CLI
- For team collaboration, each developer should have their own `config.local.js` for local development 