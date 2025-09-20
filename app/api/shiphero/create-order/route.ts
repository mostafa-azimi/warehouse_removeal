import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('ShipHero create order API route called (POST)')

    const requestBody = await request.json()
    const { accessToken, orderData } = requestBody

    console.log('Access token received:', accessToken ? 'Present' : 'Missing')
    console.log('Order data received:', JSON.stringify(orderData, null, 2))

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 401 })
    }

    if (!orderData) {
      return NextResponse.json({ error: 'Order data is required' }, { status: 400 })
    }

    const mutation = `
      mutation {
        order_create(
          data: {
            customer_account_id: "${orderData.customerAccountId}"
            order_number: "${orderData.orderNumber}"
            shop_name: "Warehouse Removal"
            fulfillment_status: "pending"
            order_date: "${new Date().toISOString().split('T')[0]}"
            total_tax: "0.00"
            subtotal: "0.00"
            total_discounts: "0.00"
            total_price: "0.00"
            email: "${orderData.customerEmail}"
            shipping_lines: {
              title: "Standard Shipping"
              price: "0.00"
            }
            shipping_address: {
              first_name: "${orderData.shippingAddress.firstName}"
              last_name: "${orderData.shippingAddress.lastName}"
              address1: "${orderData.shippingAddress.address1}"
              city: "${orderData.shippingAddress.city}"
              state: "${orderData.shippingAddress.state}"
              zip: "${orderData.shippingAddress.zip}"
              country: "US"
              country_code: "US"
              email: "${orderData.customerEmail}"
            }
            billing_address: {
              first_name: "${orderData.shippingAddress.firstName}"
              last_name: "${orderData.shippingAddress.lastName}"
              address1: "${orderData.shippingAddress.address1}"
              city: "${orderData.shippingAddress.city}"
              state: "${orderData.shippingAddress.state}"
              zip: "${orderData.shippingAddress.zip}"
              country: "US"
              country_code: "US"
              email: "${orderData.customerEmail}"
            }
            line_items: [
              ${orderData.lineItems.map((item: any, index: number) => `{
                sku: "${item.sku}"
                partner_line_item_id: "${orderData.orderNumber}-${index}"
                quantity: ${item.quantity}
                price: "1.00"
                product_name: "${item.productName}"
                fulfillment_status: "pending"
              }`).join(',')}
            ]
          }
        ) {
          request_id
          complexity
          order {
            id
            order_number
            account_id
          }
        }
      }
    `;

    console.log('GraphQL Mutation:', mutation)

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation
      } )
    })

    const responseText = await response.text()
    console.log('ShipHero Response Status:', response.status)
    console.log('ShipHero Response Body:', responseText)

    if (!response.ok) {
      throw new Error(`ShipHero API error: ${response.status} ${response.statusText}`)
    }

    const data = JSON.parse(responseText)

    if (data.errors) {
      console.error('GraphQL Errors:', data.errors)
      return NextResponse.json({ 
        error: 'ShipHero GraphQL error',
        details: data.errors
      }, { status: 400 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Create order API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: (error as Error).message
    }, { status: 500 })
  }
}

