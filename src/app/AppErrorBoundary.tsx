import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportDiagnosticError } from '@/platform/telemetry';
import { Button, SurfaceCard } from '@/shared/ui';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  correlationId?: string;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public override state: AppErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    const correlationId = reportDiagnosticError('UNHANDLED_UI_ERROR', error.message, {
      componentStackPresent: Boolean(info.componentStack),
    });
    this.setState({ correlationId });
  }

  public override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <SurfaceCard variant="solid" role="alert" className="max-w-lg space-y-4">
          <div className="flex items-center gap-2.5 text-danger">
            <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <h1 className="text-lg font-semibold text-text-primary">
              Application Display Interrupted
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            An unexpected error stopped this screen from rendering. No roster snapshots or audit
            records were modified. Reload the page to recover.
          </p>
          {this.state.correlationId ? (
            <p className="text-xs font-mono text-text-secondary">
              Diagnostic ID: {this.state.correlationId}
            </p>
          ) : null}
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span>Reload Application</span>
          </Button>
        </SurfaceCard>
      </div>
    );
  }
}
