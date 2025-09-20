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
            order_date: "${new Date().toLocaleDateString('en-CA')}"
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

    console.log('=== SHIPHERO CREATE ORDER DEBUG ===')
    console.log('Customer Account ID:', orderData.customerAccountId)
    console.log('Order Number:', orderData.orderNumber)
    console.log('Line Items Count:', orderData.lineItems?.length)
    console.log('GraphQL Mutation:', mutation)

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation
      })
    })

    const responseText = await response.text()
    console.log('=== SHIPHERO RESPONSE DEBUG ===')
    console.log('Response Status:', response.status)
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()))
    console.log('Response Body (raw):', responseText)

    if (!response.ok) {
      console.error('HTTP Error:', response.status, response.statusText)
      throw new Error(`ShipHero API error: ${response.status} ${response.statusText}`)
    }

    let data
    try {
      data = JSON.parse(responseText)
      console.log('Parsed Response Data:', JSON.stringify(data, null, 2))
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError)
      console.error('Raw response that failed to parse:', responseText)
      return NextResponse.json({ 
        error: 'Invalid JSON response from ShipHero',
        details: responseText
      }, { status: 500 })
    }

    if (data.errors) {
      console.error('=== GRAPHQL ERRORS ===')
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2))
      return NextResponse.json({ 
        error: 'ShipHero GraphQL error',
        details: data.errors
      }, { status: 400 })
    }

    // Check if order was created successfully
    if (data.data?.order_create?.order) {
      console.log('=== ORDER CREATED SUCCESSFULLY ===')
      console.log('Order ID:', data.data.order_create.order.id)
      console.log('Order Number:', data.data.order_create.order.order_number)
      console.log('Account ID:', data.data.order_create.order.account_id)
      
      // Return the order ID in the expected format
      const orderId = data.data.order_create.order.id
      console.log('Returning order ID:', orderId)
      
      return NextResponse.json({ 
        success: true,
        orderId: orderId,
        orderNumber: data.data.order_create.order.order_number,
        accountId: data.data.order_create.order.account_id,
        fullResponse: data
      })
    } else {
      console.error('=== ORDER CREATION FAILED ===')
      console.error('No order found in response:', JSON.stringify(data, null, 2))
      return NextResponse.json({ 
        error: 'Order creation failed - no order in response',
        details: data
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Create order API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: (error as Error).message
    }, { status: 500 })
  }
}

