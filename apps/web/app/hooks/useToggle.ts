import { useCallback, useState } from 'react';

/**
 * Hook for managing boolean toggle state with helper functions
 * Useful for modals, dropdowns, accordions, and any on/off state
 *
 * @param initialValue - Initial boolean value (default: false)
 * @returns Tuple of [value, toggle, setTrue, setFalse, setValue]
 *
 * @example
 * ```tsx
 * const [isOpen, toggle, open, close] = useToggle();
 *
 * return (
 *   <>
 *     <button onClick={open}>Open Modal</button>
 *     <Modal isOpen={isOpen} onClose={close}>
 *       <button onClick={toggle}>Toggle</button>
 *     </Modal>
 *   </>
 * );
 * ```
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, () => void, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  const setTrue = useCallback(() => {
    setValue(true);
  }, []);

  const setFalse = useCallback(() => {
    setValue(false);
  }, []);

  return [value, toggle, setTrue, setFalse, setValue];
}
