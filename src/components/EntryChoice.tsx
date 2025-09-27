import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FolderOpen, Plus, ArrowRight } from 'lucide-react';

interface EntryChoiceProps {
  onOpenExisting: () => void;
  onStartNew: () => void;
}

export function EntryChoice({ onOpenExisting, onStartNew }: EntryChoiceProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to ABCresearch
          </h1>
          <p className="text-xl text-gray-600">
            Choose how you'd like to get started
          </p>
        </div>

        {/* Options */}
        <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
          {/* Open Existing Project */}
          <Card 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-500"
            onClick={onOpenExisting}
          >
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FolderOpen className="h-10 w-10 text-white" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Open Existing Project
              </h2>
              
              <p className="text-gray-600 mb-6">
                View your saved market maps and research
              </p>
              
              <div className="flex items-center justify-center text-blue-600 font-semibold group-hover:text-blue-700">
                <span>Browse Projects</span>
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Start New Workflow */}
          <Card 
            className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-green-500"
            onClick={onStartNew}
          >
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-green-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Plus className="h-10 w-10 text-white" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Start New Research
              </h2>
              
              <p className="text-gray-600 mb-6">
                Begin a fresh research session
              </p>
              
              <div className="flex items-center justify-center text-green-600 font-semibold group-hover:text-green-700">
                <span>Start Research</span>
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
