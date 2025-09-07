"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

export default function TestPage() {
  const [activeTab, setActiveTab] = useState("tab1")

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-4">Test Page</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tab1">
          <div className="p-4 border rounded">
            <h2>Tab 1 Content</h2>
            <p>This is tab 1 content</p>
            <Button onClick={() => alert("Button clicked!")}>Test Button</Button>
          </div>
        </TabsContent>
        
        <TabsContent value="tab2">
          <div className="p-4 border rounded">
            <h2>Tab 2 Content</h2>
            <p>This is tab 2 content</p>
            <Button onClick={() => alert("Button clicked!")}>Test Button</Button>
          </div>
        </TabsContent>
        
        <TabsContent value="tab3">
          <div className="p-4 border rounded">
            <h2>Tab 3 Content</h2>
            <p>This is tab 3 content</p>
            <Button onClick={() => alert("Button clicked!")}>Test Button</Button>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="mt-4">
        <p>Current tab: {activeTab}</p>
        <Button onClick={() => setActiveTab("tab1")}>Go to Tab 1</Button>
        <Button onClick={() => setActiveTab("tab2")}>Go to Tab 2</Button>
        <Button onClick={() => setActiveTab("tab3")}>Go to Tab 3</Button>
      </div>
    </div>
  )
}
