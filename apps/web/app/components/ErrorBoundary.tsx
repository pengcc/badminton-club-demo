'use client';

import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useTranslations } from 'next-intl';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryMessages {
  title: string;
  description: string;
  retry: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Used to wrap Match Center tabs for graceful error handling.
 */
class ErrorBoundaryInner extends Component<
  ErrorBoundaryProps & { messages: ErrorBoundaryMessages },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { messages: ErrorBoundaryMessages }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI error boundary caught a failure', {
      operation: 'render_ui',
      reasonCode: error.name || 'UNKNOWN_ERROR',
      componentStackAvailable: Boolean(errorInfo.componentStack),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {this.props.messages.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {this.props.messages.description}
            </p>
            <Button
              onClick={this.handleReset}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {this.props.messages.retry}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default function ErrorBoundary(props: ErrorBoundaryProps) {
  const t = useTranslations('common.uiError');

  return (
    <ErrorBoundaryInner
      {...props}
      messages={{
        title: t('title'),
        description: t('description'),
        retry: t('retry'),
      }}
    />
  );
}
