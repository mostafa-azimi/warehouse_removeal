"use client"

export default function WarehouseApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Warehouse Removal App - Emergency Mode</h1>
      <p>App is working! Minimal version to get you unstuck.</p>
      <button onClick={() => alert('Button works!')}>Test Button</button>
      <div style={{ marginTop: '20px' }}>
        <h2>Status:</h2>
        <ul>
          <li>✅ Page loads</li>
          <li>✅ JavaScript works</li>
          <li>✅ Console should be accessible</li>
        </ul>
      </div>
    </div>
  )
}
