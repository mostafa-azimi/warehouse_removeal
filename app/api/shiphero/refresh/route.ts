import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('[REFRESH API] Starting token refresh request')
  
  try {
    const { refreshToken } = await request.json()
    console.log('[REFRESH API] Request body parsed, refresh token length:', refreshToken?.length || 'undefined')

    if (!refreshToken) {
      console.log('[REFRESH API] ERROR: No refresh token provided')
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    console.log('[REFRESH API] Making request to ShipHero auth endpoint')
    console.log('[REFRESH API] Request payload:', { refresh_token: refreshToken.substring(0, 20) + '...' })

    // Call ShipHero's auth endpoint from the server
    const response = await fetch('https://public-api.shiphero.com/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    })

    console.log('[REFRESH API] ShipHero response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[REFRESH API] ShipHero API error response:', errorText)
      console.error('[REFRESH API] Response headers:', Object.fromEntries(response.headers.entries()))
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[REFRESH API] Success! Token data received:', {
      access_token: data.access_token ? data.access_token.substring(0, 20) + '...' : 'undefined',
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope
    })
    
    // Return the access token and expiry info
    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope
    })

  } catch (error) {
    console.error('[REFRESH API] Unexpected error refreshing token:', error)
    console.error('[REFRESH API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
