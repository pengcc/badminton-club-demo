'use client';

// Performance monitoring utility for dashboard components
export class DashboardPerformance {
  private static measurements: Map<string, number> = new Map();

  static startMeasure(name: string) {
    this.measurements.set(name, performance.now());
  }

  static endMeasure(name: string) {
    const start = this.measurements.get(name);
    if (start) {
      const duration = performance.now() - start;
      this.measurements.delete(name);
      return duration;
    }
    return 0;
  }

  static measureAsync<T>(name: string, promise: Promise<T>): Promise<T> {
    this.startMeasure(name);
    return promise.finally(() => {
      this.endMeasure(name);
    });
  }
}

// React hook for performance monitoring
export function usePerformanceMonitor(componentName: string) {
  React.useEffect(() => {
    DashboardPerformance.startMeasure(`${componentName}-mount`);
    return () => {
      DashboardPerformance.endMeasure(`${componentName}-mount`);
    };
  }, [componentName]);
}

import React from 'react';