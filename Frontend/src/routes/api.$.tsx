import { createFileRoute } from '@tanstack/react-router'

const BACKEND_URL = process.env.VITE_BACKEND_URL || import.meta.env?.VITE_BACKEND_URL || 'https://ecolane.onrender.com'

async function handleProxy({ request }: { request: Request }) {
  const url = new URL(request.url)
  // Extract pathname and search query
  const pathname = url.pathname // e.g. /api/auth/signin
  const search = url.search // e.g. ?query=value
  
  const targetUrl = `${BACKEND_URL}${pathname}${search}`
  
  // Clone request headers and delete host and accept-encoding to avoid host mismatch and decoding issues
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('accept-encoding')
  
  let body: any = undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.clone().arrayBuffer()
    } catch (e) {
      console.warn('Could not parse request body for proxying:', e)
    }
  }
  
  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
      duplex: 'half',
    } as any)
    
    // Clean response headers to avoid encoding mismatches (since fetch decompresses automatically)
    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('content-encoding')
    responseHeaders.delete('content-length')
    responseHeaders.delete('transfer-encoding')
    
    // Hide backend infrastructure / Render details
    responseHeaders.delete('x-render-request-id')
    responseHeaders.delete('via')
    responseHeaders.delete('server')
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('API Proxy Error:', error)
    return new Response(JSON.stringify({ error: 'API Proxy Failed' }), {
      status: 502,
      headers: {
        'content-type': 'application/json',
      },
    })
  }
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handleProxy,
      POST: handleProxy,
      PUT: handleProxy,
      DELETE: handleProxy,
      PATCH: handleProxy,
      OPTIONS: handleProxy,
      HEAD: handleProxy,
    },
  },
})

export default function ApiProxy() {
  return null
}
