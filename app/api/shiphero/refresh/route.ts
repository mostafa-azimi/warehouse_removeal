import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

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

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ShipHero API error:', errorText)
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Return the access token and expiry info
    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope
    })

  } catch (error) {
    console.error('Error refreshing token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
