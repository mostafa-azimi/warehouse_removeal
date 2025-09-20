import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Log the exact request being sent
    console.log('=== SHIPHERO API DEBUG ===');
    
    const requestBody = await request.json()
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const { accessToken, customerAccountId } = requestBody
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 401 })
    }

    if (!customerAccountId) {
      return NextResponse.json({ error: 'Customer account ID is required' }, { status: 400 })
    }

    // Updated GraphQL query to properly fetch location details
    const query = `
      query GetProductLocations($customer_account_id: String!) {
        warehouse_products(customer_account_id: $customer_account_id) {
          request_id
          complexity
          data(first: 50) {
            edges {
              node {
                id
                on_hand
                inventory_bin
                product {
                  sku
                  name
                }
                locations(first: 20) {
                  edges {
                    node {
                      id
                      name
                      quantity
                      pickable
                      sellable
                      warehouse_id
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      customer_account_id: customerAccountId
    }
    
    const graphqlRequestBody = { query, variables }
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlRequestBody)
    });
    
    const responseText = await response.text();
    console.log('ShipHero Response Status:', response.status);
    console.log('ShipHero Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('ShipHero Response Body:', responseText);
    
    if (!response.ok) {
      throw new Error(`ShipHero API error: ${response.status} - ${responseText}`);
    }
    
    const data = JSON.parse(responseText);
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error('=== API ERROR ===', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}