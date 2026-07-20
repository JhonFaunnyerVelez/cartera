import Modal from './Modal';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'success' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'info'
}: ConfirmModalProps) {
  
  const Icon = type === 'danger' ? AlertCircle : type === 'success' ? CheckCircle2 : HelpCircle;
  const colorClass = type === 'danger' 
    ? 'text-rose-600 bg-rose-100' 
    : type === 'success' 
      ? 'text-emerald-600 bg-emerald-100' 
      : 'text-indigo-600 bg-indigo-100';
  
  const buttonClass = type === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700'
    : type === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-indigo-600 hover:bg-indigo-700';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="flex flex-col items-center text-center py-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${colorClass}`}>
          <Icon size={32} />
        </div>
        
        <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 mb-8 max-w-xs">{message}</p>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition order-2 sm:order-1"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-3 rounded-xl text-white font-semibold transition shadow-sm order-1 sm:order-2 ${buttonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
