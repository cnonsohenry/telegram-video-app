import { useEffect, useRef, useCallback } from "react";

/**
 * useModalHistory hook
 * Seamlessly integrates any modal or bottom sheet with browser / phone back button (popstate).
 * Prevents the phone back button from exiting the app or navigating to the previous page
 * when a modal or action sheet is open.
 *
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {function} onClose - Callback to close the modal
 * @param {string} modalKey - Unique key stored in window.history.state (e.g. "playerMenu", "postOptions")
 * @returns {function} handleSafeClose - Safe dismissal handler for backdrop, cancel, or X button
 */
export function useModalHistory(isOpen, onClose, modalKey = "modal") {
  const historyPushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Only push state if this modal key is not already active on history.state
    if (!window.history.state?.[modalKey]) {
      window.history.pushState(
        { ...(window.history.state || {}), [modalKey]: true },
        document.title
      );
      historyPushedRef.current = true;
    } else {
      historyPushedRef.current = true;
    }

    const handlePopState = (e) => {
      // If the back button popped our modal key from the state stack
      if (!e.state?.[modalKey]) {
        historyPushedRef.current = false;
        if (onCloseRef.current) {
          onCloseRef.current();
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Clean up history entry if modal unmounted without history having been popped
      if (historyPushedRef.current && window.history.state?.[modalKey]) {
        historyPushedRef.current = false;
        window.history.back();
      }
    };
  }, [isOpen, modalKey]);

  const handleSafeClose = useCallback((...args) => {
    if (historyPushedRef.current && window.history.state?.[modalKey]) {
      historyPushedRef.current = false;
      window.history.back();
    }
    if (onCloseRef.current) {
      onCloseRef.current(...args);
    }
  }, [modalKey]);

  handleSafeClose.transition = (nextModalKey) => {
    if (historyPushedRef.current && window.history.state?.[modalKey]) {
      historyPushedRef.current = false;
      const currentState = { ...(window.history.state || {}) };
      delete currentState[modalKey];
      currentState[nextModalKey] = true;
      window.history.replaceState(currentState, document.title);
    }
  };

  return handleSafeClose;
}

export default useModalHistory;
