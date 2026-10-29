import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '../Button/Button';
import styles from './PanelErrorBoundary.module.css';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class PanelErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PanelErrorBoundary: ${this.props.name}]`, error, errorInfo);
  }

  private handleCopy = () => {
    if (this.state.error) {
      navigator.clipboard.writeText(`${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack}`);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container} role="alert">
          <AlertTriangle size={28} color="var(--color-danger)" />
          <h3 className={styles.title}>{this.props.name} encountered an error</h3>
          <p className={styles.message}>
            {this.state.error?.message || 'An unexpected runtime error occurred in this panel.'}
          </p>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={this.state.copied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
              onClick={this.handleCopy}
            >
              {this.state.copied ? 'Copied' : 'Copy Error'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw size={13} />}
              onClick={this.handleReset}
            >
              Reload Panel
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
