"use client"

import { Component, type ReactNode, type ErrorInfo } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 m-4">
          <p className="text-[14px] text-red-400 font-semibold mb-1">Algo salió mal</p>
          <p className="text-[12px] text-[#c0c6d6]">{this.state.error?.message ?? "Error desconocido"}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#0A84FF]"
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
