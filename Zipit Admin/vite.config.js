import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { JWT } from 'google-auth-library'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fcm-push-api',
      configureServer(server) {
        server.middlewares.use('/api/send-push', async (req, res) => {
          if (req.method !== 'POST') return res.end();
          
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', async () => {
            try {
              const { token, title, body: msgBody } = JSON.parse(body);
              
              if (!token) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'Missing token' }));
              }

              const serviceAccountPath = path.resolve(__dirname, 'service-account.json');
              const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
              
              const jwtClient = new JWT({
                email: serviceAccount.client_email,
                key: serviceAccount.private_key,
                scopes: ['https://www.googleapis.com/auth/firebase.messaging']
              });
              
              const accessToken = await jwtClient.getAccessToken();
              const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
              
              const payload = {
                message: {
                  token: token,
                  notification: {
                    title: title,
                    body: msgBody
                  }
                }
              };
              
              const response = await fetch(fcmUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken.token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
              });
              
              const data = await response.json();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        });
      }
    }
  ],
  icons: [
    {
      src: 'logo_full.png',
      sizes: '192x192',
      type: 'image/png'
    },
    {
      src: 'logo_full.png',
      sizes: '512x512',
      type: 'image/png'
    },
    {
      src: 'logo_full.png',
      sizes: 'any',
      type: 'image/png',
      purpose: 'any maskable'
    }
  ]
})
