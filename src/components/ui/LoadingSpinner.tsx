export default function LoadingSpinner({ fullScreen = false }: { fullScreen?: boolean }) {
  const wrapper = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-white z-50'
    : 'flex items-center justify-center p-12';

  return (
    <div className={wrapper}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-full border-4 border-indigo-100 border-t-indigo-600"
          style={{ animation: 'spin 0.8s linear infinite' }}
        />
        <p className="text-slate-400 text-sm">Cargando...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
