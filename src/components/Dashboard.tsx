import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, Send } from 'lucide-react'

export function Dashboard() {
  const { signOut } = useAuth()
  const [message, setMessage] = useState('')

  const handleSendMessage = () => {
    // Placeholder for message handling
    console.log('Message sent:', message)
    setMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Half - Chat Interface */}
      <div className="w-1/2 bg-background flex flex-col">
        {/* Chat Messages Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Empty chat area ready for messages */}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 border-t">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message here..."
                  className="min-h-[50px] resize-none"
                />
              </div>
              <Button 
                onClick={handleSendMessage}
                disabled={!message.trim()}
                size="icon"
                className="h-[50px] w-[50px]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Half - Market Map */}
      <div className="w-1/2 bg-blue-100 flex items-center justify-center">
        <h1 className="text-4xl font-bold text-blue-800">Market Map</h1>
      </div>

      {/* Logout Icon - Top Left */}
      <button
        onClick={signOut}
        className="fixed top-6 left-6 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow border border-gray-200 hover:bg-gray-50"
        title="Sign Out"
      >
        <LogOut className="h-5 w-5 text-gray-600" />
      </button>
    </div>
  )
}
