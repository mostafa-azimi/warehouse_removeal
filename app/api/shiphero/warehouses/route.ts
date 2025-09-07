import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      )
    }

    // GraphQL query to get account warehouses
    const query = `
      query {
        account {
          request_id
          complexity
          data {
            warehouses {
              edges {
                node {
                  id
                  identifier
                  name
                  address {
                    name
                    address1
                    address2
                    city
                    state
                    zip
                    country
                  }
                  is_active
                }
              }
            }
          }
        }
      }
    `

    // Call ShipHero's GraphQL endpoint
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ShipHero GraphQL error:', errorText)
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      return NextResponse.json(
        { error: `GraphQL error: ${data.errors[0]?.message || 'Unknown GraphQL error'}` },
        { status: 400 }
      )
    }

    // Extract warehouse data
    const warehouses = data.data?.account?.data?.warehouses?.edges || []
    
    // Transform the data for easier use
    const transformedWarehouses = warehouses.map((edge: any) => {
      const warehouse = edge.node
      return {
        id: warehouse.id,
        identifier: warehouse.identifier,
        name: warehouse.name,
        address: {
          name: warehouse.address?.name || '',
          address1: warehouse.address?.address1 || '',
          address2: warehouse.address?.address2 || '',
          city: warehouse.address?.city || '',
          state: warehouse.address?.state || '',
          zip: warehouse.address?.zip || '',
          country: warehouse.address?.country || ''
        },
        is_active: warehouse.is_active,
        // Decode the base64 ID
        decodedId: warehouse.id ? Buffer.from(warehouse.id, 'base64').toString('utf-8') : ''
      }
    })

    return NextResponse.json({
      warehouses: transformedWarehouses,
      request_id: data.data?.account?.request_id,
      complexity: data.data?.account?.complexity
    })

  } catch (error) {
    console.error('Error querying warehouses:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
