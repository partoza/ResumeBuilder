import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Promise-based confirm dialog that replaces window.confirm().
 *
 *   const [confirm, dialog] = useConfirm();
 *   if (!(await confirm({ title, description, confirmLabel, danger }))) return;
 *   ...render {dialog} once in the tree
 */
export function useConfirm() {
  const [request, setRequest] = useState(null);
  const requestRef = useRef(null);
  requestRef.current = request;

  const confirm = useCallback(
    (options) => new Promise((resolve) => setRequest({ ...options, resolve })),
    []
  );

  const close = useCallback((result) => {
    requestRef.current?.resolve(result);
    setRequest(null);
  }, []);

  const dialog = request ? <ConfirmDialog {...request} onClose={close} /> : null;
  return [confirm, dialog];
}

function ConfirmDialog({ title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onClose }) {
  const panelRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    // Destructive actions start focused on Cancel so Enter can't wipe data by accident.
    (danger ? cancelRef : confirmRef).current?.focus();

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(false);
      } else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const items = panelRef.current.querySelectorAll('button');
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [danger, onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div
        className="modal"
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-desc' : undefined}
      >
        <div className="modal-body">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          {description && <p id="modal-desc" className="modal-desc">{description}</p>}
        </div>
        <div className="modal-footer">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onClose(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
