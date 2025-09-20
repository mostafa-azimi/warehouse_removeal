import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('ShipHero refresh token API route called');
  
  try {
    const body = await request.json();
    console.log('Request body received:', { ...body, refresh_token: body.refresh_token ? `${body.refresh_token.substring(0, 10)}...` : 'MISSING' });
    
    const { refresh_token } = body;
    
    if (!refresh_token) {
      console.error('No refresh token in request body');
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 });
    }
    
    console.log('Refreshing token with ShipHero...', `Token: ${refresh_token.substring(0, 10)}...`);
    
    // Use the correct refresh endpoint from the documentation
    const response = await fetch('https://public-api.shiphero.com/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token }),
    });
    
    console.log('ShipHero refresh response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ShipHero refresh error:', errorText);
      return NextResponse.json(
        { error: 'Failed to refresh token', details: errorText },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('Token refresh successful');
    
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
