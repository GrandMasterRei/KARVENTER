import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.locationKey !== this.props.locationKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="rounded-[32px] border border-red-100 bg-white p-8 shadow-sm shadow-red-100/40">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-2xl font-black text-red-600 ring-1 ring-red-100">
            !
          </div>
          <h2 className="text-xl font-black text-slate-950">Sayfa yüklenemedi</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
            Bu ekranda beklenmeyen bir hata oluştu. Sayfayı yenileyebilir veya başka bir menüye geçebilirsin.
          </p>
          {this.state.error?.message && (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-left text-xs font-bold text-slate-500">
              {this.state.error.message}
            </div>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="kv-button-primary mt-6 h-11 rounded-2xl px-5 text-sm font-black"
          >
            Yenile
          </button>
        </div>
      </div>
    );
  }
}
