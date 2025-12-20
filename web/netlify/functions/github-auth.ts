import type { Handler } from '@netlify/functions'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  const path = event.path.replace('/.netlify/functions/github-auth', '').replace('/api/github-auth', '')

  // GET /api/github-auth/login - Returns GitHub OAuth URL
  if (event.httpMethod === 'GET' && path === '/login') {
    const state = Math.random().toString(36).substring(7)
    const redirectUri = `${process.env.URL || 'http://localhost:8888'}/api/github-auth/callback`
    
    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${GITHUB_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=repo` +
      `&state=${state}`

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: authUrl, state })
    }
  }

  // GET /api/github-auth/callback - Exchange code for token
  if (event.httpMethod === 'GET' && path === '/callback') {
    const code = event.queryStringParameters?.code
    const error = event.queryStringParameters?.error

    if (error) {
      return {
        statusCode: 302,
        headers: { Location: '/?error=' + encodeURIComponent(error) },
        body: ''
      }
    }

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing code parameter' })
      }
    }

    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code
        })
      })

      const tokenData = await tokenResponse.json()

      if (tokenData.error) {
        return {
          statusCode: 302,
          headers: { Location: '/?error=' + encodeURIComponent(tokenData.error_description || tokenData.error) },
          body: ''
        }
      }

      // Redirect back to app with token in URL fragment (not query param for security)
      // The frontend will extract it and store it
      return {
        statusCode: 302,
        headers: { Location: `/?token=${tokenData.access_token}` },
        body: ''
      }
    } catch (err) {
      console.error('Token exchange error:', err)
      return {
        statusCode: 302,
        headers: { Location: '/?error=token_exchange_failed' },
        body: ''
      }
    }
  }

  // POST /api/github-auth/logout - Just returns success (token is client-side)
  if (event.httpMethod === 'POST' && path === '/logout') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: 'Not found' })
  }
}
