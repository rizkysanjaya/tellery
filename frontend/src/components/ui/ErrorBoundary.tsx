/**
 * =============================================================================
 * Module: frontend/src/components/ui/ErrorBoundary.tsx
 * Purpose: Top-level React Error Boundary providing graceful fault tolerance,
 *          catching unhandled render exceptions and rendering a Silk Cloud recovery UI.
 * Used by: frontend/src/main.tsx
 * Dependencies: React, lucide-react (AlertTriangle, RefreshCw)
 * Public Members: ErrorBoundary
 * Side Effects: Catches component tree errors; interacts with window.location for reload.
 * =============================================================================
 */

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[TeleGallery ErrorBoundary] Uncaught render exception:", error, errorInfo);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full bg-background flex items-center justify-center p-6 text-on-surface">
          <div className="max-w-md w-full neo-card rounded-neo-xl p-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-full neo-pressed bg-surface-base flex items-center justify-center text-error shadow-inner">
              <AlertTriangle className="w-8 h-8 text-rose-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-on-surface tracking-tight">Something Went Wrong</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                TeleGallery encountered an unexpected display error. Your cloud media and vault files remain safe in Telegram.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-neo neo-pressed bg-surface-container-lowest text-xs font-mono text-on-surface-variant/80 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-neo neo-button text-sm font-semibold text-primary hover:text-primary-hover active:neo-pressed flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Gallery</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
