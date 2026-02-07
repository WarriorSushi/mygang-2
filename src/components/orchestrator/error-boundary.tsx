'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    }

    public static getDerivedStateFromError(): State {
        return { hasError: true }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-4 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 m-4">
                    <AlertCircle size={48} className="text-destructive mb-2" />
                    <h2 className="text-xl font-bold italic uppercase tracking-tighter">Vibe Check Failed</h2>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Something went sideways in the holographic matrix.
                    </p>
                    <Button
                        onClick={() => window.location.reload()}
                        className="rounded-full gap-2 px-6"
                    >
                        <RefreshCw size={16} /> Reboot Matrix
                    </Button>
                </div>
            )
        }

        return this.props.children
    }
}
